import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AdvertiserStats, AdvertiserStatsResult } from '../types/shared.js';

interface ConcurrencyConfig {
  maxConcurrentRequests: number;
  connectionPoolSize: number;
  requestTimeout: number;
  batchSize: number;
  cacheTTL: number;
}

interface BatchRequest {
  pageId: string;
  country: string;
  resolve: (result: AdvertiserStatsResult) => void;
  reject: (error: Error) => void;
}

interface ConnectionPool {
  activeConnections: number;
  queue: Array<() => Promise<void>>;
  maxConnections: number;
}

export class HighConcurrencyScraperService {
  private cache = new Map<string, { data: AdvertiserStats; timestamp: number }>();
  private genAI: GoogleGenerativeAI | null = null;
  private config: ConcurrencyConfig;
  private connectionPool: ConnectionPool;
  private batchQueue: BatchRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private stats = {
    totalRequests: 0,
    cacheHits: 0,
    batchedRequests: 0,
    errors: 0,
    avgResponseTime: 0
  };

  constructor(config?: Partial<ConcurrencyConfig>) {
    this.config = {
      maxConcurrentRequests: 50, // Facebook limit protection
      connectionPoolSize: 20,    // HTTP connection reuse
      requestTimeout: 15000,     // Faster timeout for scale
      batchSize: 10,            // Batch multiple pageIds
      cacheTTL: 1800000,        // 30 minutes cache
      ...config
    };

    this.connectionPool = {
      activeConnections: 0,
      queue: [],
      maxConnections: this.config.connectionPoolSize
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }

    console.log(`🚀 High Concurrency Scraper initialized:
    ┌─ Max Concurrent: ${this.config.maxConcurrentRequests}
    ├─ Connection Pool: ${this.config.connectionPoolSize}
    ├─ Batch Size: ${this.config.batchSize}
    └─ Cache TTL: ${this.config.cacheTTL / 1000}s`);
  }

  async getAdvertiserStats(pageId: string, country: string = 'ALL'): Promise<AdvertiserStatsResult> {
    this.stats.totalRequests++;
    const startTime = Date.now();

    try {
      // 1. CACHE CHECK - Ultra fast for repeated requests
      const cacheKey = `${pageId}:${country}`;
      const cached = this.getCachedStats(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        console.log(`⚡ Cache hit for ${pageId} (${this.stats.cacheHits}/${this.stats.totalRequests} hits)`);
        return {
          success: true,
          stats: cached,
          executionTime: Date.now() - startTime
        };
      }

      // 2. BATCHING - Group requests to reduce Facebook calls
      return new Promise((resolve, reject) => {
        this.batchQueue.push({ pageId, country, resolve, reject });
        
        if (this.batchQueue.length >= this.config.batchSize) {
          this.processBatch();
        } else if (!this.batchTimer) {
          // Process batch after 100ms even if not full
          this.batchTimer = setTimeout(() => this.processBatch(), 100);
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

  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0, this.config.batchSize);
    this.stats.batchedRequests += batch.length;
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    console.log(`📦 Processing batch of ${batch.length} requests`);

    // Process batch with connection pooling
    const promises = batch.map(request => this.processWithPool(request));
    await Promise.allSettled(promises);
  }

  private async processWithPool(request: BatchRequest): Promise<void> {
    return new Promise((resolve) => {
      const task = async () => {
        try {
          const result = await this.scrapeSinglePage(request.pageId, request.country);
          request.resolve(result);
        } catch (error) {
          request.reject(error as Error);
        } finally {
          this.connectionPool.activeConnections--;
          this.processQueue();
          resolve();
        }
      };

      if (this.connectionPool.activeConnections < this.connectionPool.maxConnections) {
        this.connectionPool.activeConnections++;
        task();
      } else {
        this.connectionPool.queue.push(task);
      }
    });
  }

  private processQueue(): void {
    if (this.connectionPool.queue.length > 0 && 
        this.connectionPool.activeConnections < this.connectionPool.maxConnections) {
      const task = this.connectionPool.queue.shift();
      if (task) {
        this.connectionPool.activeConnections++;
        task();
      }
    }
  }

  private async scrapeSinglePage(pageId: string, country: string): Promise<AdvertiserStatsResult> {
    const startTime = Date.now();
    
    try {
      // Optimized URL for faster response
      const adLibraryUrl = this.buildOptimizedUrl(pageId, country);
      
      // Fetch with aggressive timeout and minimal headers
      const htmlContent = await this.fetchOptimized(adLibraryUrl);
      
      // Fast script extraction - only get what we need
      const scriptContents = this.extractCriticalScripts(htmlContent);
      
      // AI analysis with shorter prompts for speed
      const aiAnalysis = await this.fastAIAnalysis(scriptContents, pageId);
      
      const stats: AdvertiserStats = {
        pageId,
        advertiserName: aiAnalysis.advertiserName || 'Unknown',
        totalActiveAds: aiAnalysis.totalActiveAds,
        lastUpdated: new Date().toISOString()
      };

      // Cache immediately
      const cacheKey = `${pageId}:${country}`;
      this.cache.set(cacheKey, { data: stats, timestamp: Date.now() });

      const executionTime = Date.now() - startTime;
      this.updateAvgResponseTime(executionTime);

      console.log(`✅ Scraped ${pageId}: ${aiAnalysis.totalActiveAds} ads in ${executionTime}ms`);

      return {
        success: true,
        stats,
        executionTime
      };

    } catch (error) {
      this.stats.errors++;
      console.error(`❌ Scraping failed for ${pageId}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Scraping failed',
        executionTime: Date.now() - startTime
      };
    }
  }

  private buildOptimizedUrl(pageId: string, country: string): string {
    // Minimal parameters for faster response
    const params = new URLSearchParams({
      active_status: 'active',
      search_type: 'page',
      view_all_page_id: pageId,
      country: country,
      // Remove heavy parameters
      media_type: 'all',
      ad_type: 'all'
    });

    return `https://www.facebook.com/ads/library/?${params.toString()}`;
  }

  private async fetchOptimized(url: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          // Minimal headers for speed
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cache-Control': 'max-age=0'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();

    } finally {
      clearTimeout(timeoutId);
    }
  }

  private extractCriticalScripts(html: string): string[] {
    // Ultra-fast extraction - only the most relevant scripts
    const criticalPatterns = [
      /__INITIAL_DATA__[^}]+}/g,
      /apolloState[^}]+}/g,
      /"active_status":"active"[^}]+}/g,
      /"total_count":\d+/g,
      /"result_count":\d+/g
    ];

    const scripts: string[] = [];
    
    for (const pattern of criticalPatterns) {
      const matches = html.match(pattern);
      if (matches) {
        scripts.push(...matches);
      }
    }

    return scripts.slice(0, 5); // Only top 5 most relevant
  }

  private async fastAIAnalysis(scriptContents: string[], pageId: string): Promise<{
    totalActiveAds: number;
    advertiserName: string | null;
  }> {
    if (!this.genAI || scriptContents.length === 0) {
      return { totalActiveAds: 0, advertiserName: null };
    }

    // Shorter, more focused prompt for faster processing
    const dataString = scriptContents.join('\n').substring(0, 1500); // Limit size
    
    const prompt = `Extract from this Facebook ads data:
DATA: ${dataString}

Find:
1. Total active ads count (look for numbers near "active", "count", "total")
2. Advertiser name (page name)

Respond JSON only:
{"totalActiveAds": number, "advertiserName": "string or null"}`;

    try {
      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash-latest",
        generationConfig: {
          maxOutputTokens: 100, // Limit for speed
          temperature: 0 // Deterministic for caching
        }
      });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return {
          totalActiveAds: parseInt(analysis.totalActiveAds) || 0,
          advertiserName: analysis.advertiserName || null
        };
      }

      return { totalActiveAds: 0, advertiserName: null };

    } catch (error) {
      console.warn(`⚠️ AI analysis failed for ${pageId}:`, error);
      return { totalActiveAds: 0, advertiserName: null };
    }
  }

  private getCachedStats(cacheKey: string): AdvertiserStats | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.config.cacheTTL) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }

  private updateAvgResponseTime(newTime: number): void {
    this.stats.avgResponseTime = 
      (this.stats.avgResponseTime * (this.stats.totalRequests - 1) + newTime) / this.stats.totalRequests;
  }

  getPerformanceStats() {
    const cacheHitRate = (this.stats.cacheHits / this.stats.totalRequests * 100).toFixed(1);
    
    return {
      ...this.stats,
      cacheHitRate: `${cacheHitRate}%`,
      cacheSize: this.cache.size,
      activeConnections: this.connectionPool.activeConnections,
      queuedRequests: this.connectionPool.queue.length,
      batchQueueSize: this.batchQueue.length,
      avgResponseTime: `${this.stats.avgResponseTime.toFixed(0)}ms`
    };
  }

  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ High concurrency cache cleared');
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down high concurrency scraper...');
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    // Process remaining batches
    if (this.batchQueue.length > 0) {
      await this.processBatch();
    }
    
    console.log('✅ High concurrency scraper shutdown complete');
  }
}

// Global instance with optimized config for 1000 users
export const highConcurrencyScraperService = new HighConcurrencyScraperService({
  maxConcurrentRequests: 100,  // Increased for 1000 users
  connectionPoolSize: 50,      // More connections
  requestTimeout: 10000,       // Faster timeout
  batchSize: 20,              // Larger batches
  cacheTTL: 3600000           // 1 hour cache for better hit rate
});
