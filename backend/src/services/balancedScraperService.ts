import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AdvertiserStats, AdvertiserStatsResult } from '../types/shared.js';

interface ScriptContent {
  content: string;
  type: string;
  size: number;
}

interface BatchRequest {
  pageId: string;
  country: string;
  resolve: (result: AdvertiserStatsResult) => void;
  reject: (error: Error) => void;
}

export class BalancedScraperService {
  private cache = new Map<string, { data: AdvertiserStats; timestamp: number }>();
  private genAI: GoogleGenerativeAI | null = null;
  private batchQueue: BatchRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private activeRequests = 0;
  private maxConcurrent = 20; // Reduced from 100 for better accuracy
  private stats = {
    totalRequests: 0,
    cacheHits: 0,
    successfulScrapes: 0,
    errors: 0
  };

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }

    console.log(`⚖️ Balanced Scraper Service initialized:
    ┌─ Max Concurrent: ${this.maxConcurrent}
    ├─ Batch Size: 5 (smaller for accuracy)
    └─ Cache TTL: 30 minutes`);
  }

  async getAdvertiserStats(pageId: string, country: string = 'ALL'): Promise<AdvertiserStatsResult> {
    this.stats.totalRequests++;
    const startTime = Date.now();

    try {
      // 1. Check cache first
      const cacheKey = `${pageId}:${country}`;
      const cached = this.getCachedStats(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        console.log(`⚡ Cache hit for ${pageId}: ${cached.totalActiveAds} ads`);
        return {
          success: true,
          stats: cached,
          executionTime: Date.now() - startTime
        };
      }

      // 2. Direct processing if under concurrency limit
      if (this.activeRequests < this.maxConcurrent) {
        return await this.processDirectly(pageId, country);
      }

      // 3. Batch processing if over limit
      return new Promise((resolve, reject) => {
        this.batchQueue.push({ pageId, country, resolve, reject });
        
        if (this.batchQueue.length >= 5) { // Smaller batch size
          this.processBatch();
        } else if (!this.batchTimer) {
          this.batchTimer = setTimeout(() => this.processBatch(), 200); // Longer wait for better batching
        }
      });

    } catch (error) {
      this.stats.errors++;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  private async processDirectly(pageId: string, country: string): Promise<AdvertiserStatsResult> {
    this.activeRequests++;
    
    try {
      return await this.scrapePage(pageId, country);
    } finally {
      this.activeRequests--;
    }
  }

  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0, 5); // Smaller batches
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    console.log(`📦 Processing batch of ${batch.length} requests`);

    // Process batch with controlled concurrency
    const promises = batch.map(request => this.processWithControl(request));
    await Promise.allSettled(promises);
  }

  private async processWithControl(request: BatchRequest): Promise<void> {
    // Wait for available slot
    while (this.activeRequests >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.activeRequests++;
    
    try {
      const result = await this.scrapePage(request.pageId, request.country);
      request.resolve(result);
    } catch (error) {
      request.reject(error as Error);
    } finally {
      this.activeRequests--;
    }
  }

  private async scrapePage(pageId: string, country: string): Promise<AdvertiserStatsResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Scraping pageId: ${pageId} with balanced approach`);
      
      // Build Facebook Ads Library URL (same as original)
      const adLibraryUrl = this.buildAdLibraryUrl(pageId, country);
      
      // Fetch HTML content with proper timeout
      const htmlContent = await this.fetchHtmlContent(adLibraryUrl);
      
      // Try direct extraction first (much faster and more accurate)
      const directCount = this.extractDirectAdsCount(htmlContent);
      let aiAnalysis: { totalActiveAds: number; advertiserName: string | null };
      
      if (directCount !== null) {
        // Direct extraction successful
        const advertiserName = this.extractAdvertiserName(htmlContent);
        aiAnalysis = {
          totalActiveAds: directCount,
          advertiserName: advertiserName || 'Unknown'
        };
        console.log(`✅ Direct extraction successful for ${pageId}: ${directCount} ads`);
      } else {
        // Fallback to AI analysis
        console.log(`🤖 Falling back to AI analysis for ${pageId}`);
        const scriptContents = this.extractScriptTagsImproved(htmlContent);
        aiAnalysis = await this.analyzeWithGeminiImproved(scriptContents, pageId);
      }
      
      const stats: AdvertiserStats = {
        pageId,
        advertiserName: aiAnalysis.advertiserName || 'Unknown',
        totalActiveAds: aiAnalysis.totalActiveAds,
        lastUpdated: new Date().toISOString()
      };

      // Cache the result
      const cacheKey = `${pageId}:${country}`;
      this.cache.set(cacheKey, { data: stats, timestamp: Date.now() });

      const executionTime = Date.now() - startTime;
      this.stats.successfulScrapes++;

      console.log(`✅ Balanced scrape completed for ${pageId}: ${aiAnalysis.totalActiveAds} ads in ${executionTime}ms`);

      return {
        success: true,
        stats,
        executionTime
      };

    } catch (error) {
      this.stats.errors++;
      console.error(`❌ Balanced scraping failed for ${pageId}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Scraping failed',
        executionTime: Date.now() - startTime
      };
    }
  }

  private buildAdLibraryUrl(pageId: string, country: string): string {
    const baseUrl = 'https://www.facebook.com/ads/library/';
    const params = new URLSearchParams({
      active_status: 'active',
      ad_type: 'all',
      country: country,
      is_targeted_country: 'false',
      media_type: 'all',
      search_type: 'page',
      view_all_page_id: pageId
    });

    return `${baseUrl}?${params.toString()}`;
  }

  private async fetchHtmlContent(url: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      console.log(`📄 HTML fetched: ${html.length} characters`);
      return html;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private extractScriptTagsImproved(html: string): ScriptContent[] {
    const scriptContents: ScriptContent[] = [];
    
    // Look for specific Facebook Relay data patterns that contain the count
    const scriptRegex = /<script[^>]*data-sjs[^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = scriptRegex.exec(html)) !== null) {
      const scriptContent = match[1].trim();
      
      // Target specific patterns that contain the ads count
      if (scriptContent.length > 100 && (
        scriptContent.includes('RelayPrefetchedStreamCache') ||
        scriptContent.includes('AdLibraryFoundationRootQueryRelayPreloader') ||
        scriptContent.includes('search_results_connection') ||
        scriptContent.includes('ad_library_main') ||
        scriptContent.includes('count') ||
        scriptContent.includes('edges') ||
        scriptContent.includes('collated_results')
      )) {
        scriptContents.push({
          content: scriptContent,
          type: this.detectScriptType(scriptContent),
          size: scriptContent.length
        });
      }
    }

    // Also look for regular script tags with relevant data
    const regularScriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let regularMatch;

    while ((regularMatch = regularScriptRegex.exec(html)) !== null) {
      const scriptContent = regularMatch[1].trim();
      
      // More lenient filtering for fallback
      if (scriptContent.length > 50 && (
        scriptContent.includes('ads') ||
        scriptContent.includes('library') ||
        scriptContent.includes('active') ||
        scriptContent.includes('count') ||
        scriptContent.includes('result') ||
        scriptContent.includes('data') ||
        scriptContent.includes('page') ||
        scriptContent.includes('total') ||
        scriptContent.includes('Apollo') ||
        scriptContent.includes('__INITIAL') ||
        scriptContent.includes('GraphQL') ||
        scriptContent.includes('state')
      )) {
        // Avoid duplicates
        const isDuplicate = scriptContents.some(existing => 
          existing.content.substring(0, 500) === scriptContent.substring(0, 500)
        );
        
        if (!isDuplicate) {
          scriptContents.push({
            content: scriptContent,
            type: this.detectScriptType(scriptContent),
            size: scriptContent.length
          });
        }
      }
    }

    console.log(`📜 Extracted ${scriptContents.length} script tags (Facebook-optimized method)`);
    return scriptContents;
  }

  private detectScriptType(content: string): string {
    if (content.includes('RelayPrefetchedStreamCache') && content.includes('search_results_connection')) return 'facebook_relay_ads';
    if (content.includes('AdLibraryFoundationRootQueryRelayPreloader')) return 'facebook_relay_preloader';
    if (content.includes('__INITIAL_DATA__') || content.includes('initialData')) return 'initial_data';
    if (content.includes('Apollo') || content.includes('GraphQL')) return 'apollo_graphql';
    if (content.includes('React') || content.includes('props')) return 'react_props';
    if (content.includes('ads') && content.includes('count')) return 'ads_data';
    if (content.includes('page') && content.includes('info')) return 'page_info';
    if (content.includes('total') && content.includes('result')) return 'result_data';
    return 'unknown';
  }

  private extractDirectAdsCount(html: string): number | null {
    try {
      // Pattern with escaped quotes for JavaScript strings: \"search_results_connection\":{\"count\":82
      const escapedPattern = /\\?"search_results_connection\\?":\s*\{[^}]*\\?"count\\?":\s*(\d+)/i;
      const escapedMatch = html.match(escapedPattern);
      
      if (escapedMatch) {
        const count = parseInt(escapedMatch[1]);
        console.log(`🎯 Direct extraction found count: ${count} via escaped pattern`);
        return count;
      }

      // Pattern for ad_library_main with escaped quotes
      const adLibraryEscapedPattern = /\\?"ad_library_main\\?":\s*\{[^}]*\\?"search_results_connection\\?":\s*\{[^}]*\\?"count\\?":\s*(\d+)/i;
      const adLibraryEscapedMatch = html.match(adLibraryEscapedPattern);
      
      if (adLibraryEscapedMatch) {
        const count = parseInt(adLibraryEscapedMatch[1]);
        console.log(`🎯 Direct extraction found count: ${count} via ad_library escaped pattern`);
        return count;
      }

      // Look for AdLibraryFoundationRootQueryRelayPreloader pattern
      const preloaderPattern = /AdLibraryFoundationRootQueryRelayPreloader[\s\S]*?search_results_connection[\s\S]*?count[^:]*:\s*(\d+)/i;
      const preloaderMatch = html.match(preloaderPattern);
      
      if (preloaderMatch) {
        const count = parseInt(preloaderMatch[1]);
        console.log(`🎯 Direct extraction found count: ${count} via preloader pattern`);
        return count;
      }

      // Most specific pattern: RelayPrefetchedStreamCache with ad_library_main and search_results_connection
      const exactPattern = /"ad_library_main":\s*\{[^}]*"search_results_connection":\s*\{[^}]*"count":\s*(\d+)/i;
      const exactMatch = html.match(exactPattern);
      
      if (exactMatch) {
        const count = parseInt(exactMatch[1]);
        console.log(`🎯 Direct extraction found count: ${count} via exact ad_library_main pattern`);
        return count;
      }

      // General search_results_connection pattern
      const searchResultsPattern = /"search_results_connection":\s*\{[^}]*"count":\s*(\d+)/i;
      const searchResultsMatch = html.match(searchResultsPattern);
      
      if (searchResultsMatch) {
        const count = parseInt(searchResultsMatch[1]);
        console.log(`🎯 Direct extraction found count: ${count} via search_results_connection pattern`);
        return count;
      }

      // Fallback: any "count": number near ads-related keywords
      const fallbackPattern = /(?:ads?|library|active)[^}]*"count":\s*(\d+)|"count":\s*(\d+)[^}]*(?:ads?|library|active)/i;
      const fallbackMatch = html.match(fallbackPattern);
      
      if (fallbackMatch) {
        const count = parseInt(fallbackMatch[1] || fallbackMatch[2]);
        console.log(`🎯 Direct extraction found count: ${count} via fallback pattern`);
        return count;
      }

      console.log(`⚠️ No direct count pattern found in HTML`);
      return null;
    } catch (error) {
      console.error(`❌ Error in direct extraction:`, error);
      return null;
    }
  }

  private extractAdvertiserName(html: string): string | null {
    try {
      // Look for page name with escaped quotes
      const escapedPageNamePattern = /\\?"page_name\\?":\s*\\?"([^"\\]+)\\?"/i;
      const escapedMatch = html.match(escapedPageNamePattern);
      
      if (escapedMatch) {
        const name = escapedMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        console.log(`🏷️ Found advertiser name (escaped): ${name}`);
        return name;
      }

      // Look for page name in the Relay data
      const pageNamePattern = /"page_name":\s*"([^"]+)"/i;
      const pageNameMatch = html.match(pageNamePattern);
      
      if (pageNameMatch) {
        const name = pageNameMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        console.log(`🏷️ Found advertiser name: ${name}`);
        return name;
      }

      // Alternative pattern for page name
      const altPageNamePattern = /"name":\s*"([^"]+)"[^}]*"id":\s*"\d+"/i;
      const altMatch = html.match(altPageNamePattern);
      
      if (altMatch) {
        const name = altMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        console.log(`🏷️ Found advertiser name (alt pattern): ${name}`);
        return name;
      }

      console.log(`⚠️ No advertiser name found`);
      return null;
    } catch (error) {
      console.error(`❌ Error extracting advertiser name:`, error);
      return null;
    }
  }

  private async analyzeWithGeminiImproved(scriptContents: ScriptContent[], pageId: string): Promise<{
    totalActiveAds: number;
    advertiserName: string | null;
  }> {
    if (!this.genAI || scriptContents.length === 0) {
      console.log(`⚠️ No AI or scripts available for ${pageId}`);
      return { totalActiveAds: 0, advertiserName: null };
    }

    console.log(`🤖 AI analyzing ${scriptContents.length} scripts for ${pageId}`);

    // Take more scripts but with better priority
    const relevantScripts = scriptContents
      .filter(script => script.type !== 'unknown')
      .sort((a, b) => {
        // Priority: ads_data > apollo_graphql > initial_data > others
        const priority = { 'ads_data': 5, 'apollo_graphql': 4, 'initial_data': 3, 'result_data': 2 };
        const aPrio = priority[a.type] || 1;
        const bPrio = priority[b.type] || 1;
        if (aPrio !== bPrio) return bPrio - aPrio;
        return b.size - a.size;
      })
      .slice(0, 5); // Take more scripts

    if (relevantScripts.length === 0) {
      console.log(`⚠️ No relevant scripts found for pageId: ${pageId}`);
      return { totalActiveAds: 0, advertiserName: null };
    }

    // Prepare content with better context
    const scriptsText = relevantScripts
      .map((script, index) => `=== SCRIPT ${index + 1} (${script.type}, ${script.size} chars) ===\n${script.content.substring(0, 3000)}`) // More content
      .join('\n\n');

    const prompt = `
Analiza estos scripts de JavaScript de la biblioteca de anuncios de Facebook para el pageId: ${pageId}.

TAREA: Encontrar el número exacto de anuncios activos de esta página/anunciante.

BUSCA ESPECÍFICAMENTE:
- Números junto a palabras como: "ads", "anuncios", "active", "total", "count", "results", "resultados"
- Patrones como: "total_count": 123, "active_count": 45, "result_count": 67
- JSON con datos de anuncios
- Estructuras GraphQL con información de ads
- Variables de estado con conteos

CONTENIDO:
${scriptsText}

IMPORTANTE: Si encuentras números, extrae el valor exacto. Si no encuentras datos claros, devuelve 0.

Responde SOLO en formato JSON:
{
  "totalActiveAds": número_entero_exacto,
  "advertiserName": "nombre_encontrado_o_null",
  "confidence": "high|medium|low",
  "evidence": "breve_descripción_de_donde_encontraste_el_número"
}`;

    try {
      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash-latest",
        generationConfig: {
          maxOutputTokens: 200,
          temperature: 0
        }
      });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log(`🤖 AI response for ${pageId}: ${text.substring(0, 150)}...`);

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`⚠️ Invalid AI response for ${pageId}`);
        return { totalActiveAds: 0, advertiserName: null };
      }

      const analysis = JSON.parse(jsonMatch[0]);
      
      console.log(`🎯 AI found for ${pageId}: ${analysis.totalActiveAds} ads, confidence: ${analysis.confidence}`);

      return {
        totalActiveAds: parseInt(analysis.totalActiveAds) || 0,
        advertiserName: analysis.advertiserName || null
      };

    } catch (error) {
      console.error(`❌ AI analysis failed for ${pageId}:`, error);
      return { totalActiveAds: 0, advertiserName: null };
    }
  }

  private getCachedStats(cacheKey: string): AdvertiserStats | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    const maxAge = 30 * 60 * 1000; // 30 minutes

    if (age > maxAge) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }

  getPerformanceStats() {
    const cacheHitRate = this.stats.totalRequests > 0 
      ? (this.stats.cacheHits / this.stats.totalRequests * 100).toFixed(1)
      : '0';
    
    return {
      ...this.stats,
      cacheHitRate: `${cacheHitRate}%`,
      cacheSize: this.cache.size,
      activeRequests: this.activeRequests,
      queuedRequests: this.batchQueue.length,
      successRate: this.stats.totalRequests > 0 
        ? `${(this.stats.successfulScrapes / this.stats.totalRequests * 100).toFixed(1)}%`
        : '0%'
    };
  }

  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Balanced scraper cache cleared');
  }
}

// Global instance
export const balancedScraperService = new BalancedScraperService();
