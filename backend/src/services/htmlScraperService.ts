import { httpPoolService } from './httpPoolService.js';
import { geminiPoolService } from './geminiPoolService.js';
import { multiLevelCache } from './multiLevelCache.js';
import type { AdvertiserStats, AdvertiserStatsResult } from '../types/shared.js';

interface HtmlScrapingOptions {
  pageId: string;
  country?: string;
  maxRetries?: number;
}

interface ScriptContent {
  content: string;
  type: string;
  size: number;
}

export class HtmlScraperService {
  constructor() {
    console.log('🌐 HTML Scraper Service initialized with multi-level caching and pooling');
  }

  async getAdvertiserStats(options: HtmlScrapingOptions): Promise<AdvertiserStatsResult> {
    const { pageId, country = 'ALL', maxRetries = 3 } = options;
    const startTime = Date.now();

    try {
      // Check multi-level cache first
      const cacheKey = `advertiser-stats:${pageId}:${country}`;
      const cached = await multiLevelCache.get<AdvertiserStats>(cacheKey);
      if (cached) {
        console.log(`📊 Using cached stats for pageId ${pageId}: ${cached.totalActiveAds} ads`);
        return {
          success: true,
          stats: cached,
          executionTime: Date.now() - startTime
        };
      }

      console.log(`🌐 Fetching HTML for pageId: ${pageId} via HTTP`);

      // Build Facebook Ads Library URL
      const adLibraryUrl = this.buildAdLibraryUrl(pageId, country);
      
      // Fetch HTML content using HTTP pool
      const htmlContent = await httpPoolService.fetchHtml({
        url: adLibraryUrl,
        timeout: 30000,
        retries: maxRetries
      });
      
      // Extract script tags
      const scriptContents = this.extractScriptTags(htmlContent);
      
      // Use Gemini AI to analyze and count ads
      const aiAnalysis = await this.analyzeWithGemini(scriptContents, pageId);
      
      const stats: AdvertiserStats = {
        pageId,
        advertiserName: aiAnalysis.advertiserName || 'Unknown',
        totalActiveAds: aiAnalysis.totalActiveAds,
        lastUpdated: new Date().toISOString()
      };

      // Cache the result in multi-level cache
      await multiLevelCache.set(cacheKey, stats, 1800); // 30 minutes

      const executionTime = Date.now() - startTime;
      console.log(`✅ HTML+AI analysis completed in ${executionTime}ms. Found ${aiAnalysis.totalActiveAds} total ads for ${aiAnalysis.advertiserName || pageId}`);

      return {
        success: true,
        stats,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('❌ HTML+AI analysis failed:', error);
      
      // For timeout errors, return default stats instead of failure
      if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('ECONNRESET'))) {
        console.log(`⏰ Network timeout for pageId ${pageId}, returning default stats`);
        return {
          success: true,
          stats: {
            totalActiveAds: 0,
            advertiserName: 'Unknown (Timeout)',
            pageId: pageId,
            lastUpdated: new Date().toISOString()
          },
          executionTime
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
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


  private extractScriptTags(html: string): ScriptContent[] {
    const scriptContents: ScriptContent[] = [];
    
    // Regular expression to match script tags and their content
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = scriptRegex.exec(html)) !== null) {
      const scriptContent = match[1].trim();
      
      // Only process scripts that might contain ads data
      if (scriptContent.length > 100 && (
        scriptContent.includes('ads') ||
        scriptContent.includes('library') ||
        scriptContent.includes('active') ||
        scriptContent.includes('count') ||
        scriptContent.includes('result') ||
        scriptContent.includes('data') ||
        scriptContent.includes('page')
      )) {
        scriptContents.push({
          content: scriptContent,
          type: this.detectScriptType(scriptContent),
          size: scriptContent.length
        });
      }
    }

    console.log(`📜 Extracted ${scriptContents.length} relevant script tags`);
    return scriptContents;
  }

  private detectScriptType(content: string): string {
    if (content.includes('__INITIAL_DATA__') || content.includes('initialData')) return 'initial_data';
    if (content.includes('Apollo') || content.includes('GraphQL')) return 'apollo_graphql';
    if (content.includes('React') || content.includes('props')) return 'react_props';
    if (content.includes('ads') && content.includes('count')) return 'ads_data';
    if (content.includes('page') && content.includes('info')) return 'page_info';
    return 'unknown';
  }

  private async analyzeWithGemini(scriptContents: ScriptContent[], pageId: string): Promise<{
    totalActiveAds: number;
    advertiserName: string | null;
  }> {
    if (!this.genAI) {
      throw new Error('Gemini AI not configured');
    }

    console.log(`🤖 Analyzing ${scriptContents.length} script tags with Gemini AI`);

    // Prepare the content for AI analysis
    const relevantScripts = scriptContents
      .filter(script => script.type !== 'unknown')
      .sort((a, b) => b.size - a.size) // Sort by size, largest first
      .slice(0, 3); // Take only the 3 most relevant scripts

    if (relevantScripts.length === 0) {
      console.log(`⚠️ No relevant scripts found for pageId: ${pageId}`);
      return { totalActiveAds: 0, advertiserName: null };
    }

    const scriptsText = relevantScripts
      .map((script, index) => `=== SCRIPT ${index + 1} (${script.type}) ===\n${script.content.substring(0, 2000)}`)
      .join('\n\n');

    const prompt = `
Analiza el siguiente contenido de scripts de JavaScript extraído de la biblioteca de anuncios de Facebook para el pageId: ${pageId}.

Tu tarea es:
1. Encontrar el número total de anuncios activos
2. Encontrar el nombre del anunciante/página

Busca específicamente:
- Números que representen conteos de anuncios (ej: "123 resultados", "45 ads", "total: 67")
- Nombres de páginas o anunciantes
- Datos JSON que contengan información de anuncios

CONTENIDO DE SCRIPTS:
${scriptsText}

Responde SOLO en formato JSON:
{
  "totalActiveAds": número_entero,
  "advertiserName": "nombre_del_anunciante_o_null",
  "confidence": "high|medium|low",
  "reasoning": "breve_explicación_de_cómo_encontraste_los_datos"
}

Si no encuentras información clara, devuelve totalActiveAds: 0 y advertiserName: null.
`;

    try {
      // Use the new Gemini pool service for better concurrency
      const text = await geminiPoolService.analyzeContent(prompt, 5); // High priority

      console.log(`🤖 Gemini AI response: ${text.substring(0, 200)}...`);

      // Parse the JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      
      console.log(`🎯 AI Analysis - Ads: ${analysis.totalActiveAds}, Name: ${analysis.advertiserName}, Confidence: ${analysis.confidence}`);

      return {
        totalActiveAds: parseInt(analysis.totalActiveAds) || 0,
        advertiserName: analysis.advertiserName || null
      };

    } catch (error) {
      console.error('❌ Gemini AI analysis failed:', error);
      throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  clearCache(): void {
    multiLevelCache.clear();
    console.log('🗑️ HTML scraper cache cleared');
  }

  getCacheStats() {
    return multiLevelCache.getStats();
  }
}

// Global instance
export const htmlScraperService = new HtmlScraperService();
