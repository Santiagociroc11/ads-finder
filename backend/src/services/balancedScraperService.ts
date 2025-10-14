import type { AdvertiserStats, AdvertiserStatsResult } from '../types/shared.js';
import { scrapeCreatorsService } from './scrapeCreatorsService.js';
import { creditsTrackingService } from './creditsTrackingService.js';

interface BatchRequest {
  pageId: string;
  country: string;
  userId?: string;
  resolve: (result: AdvertiserStatsResult) => void;
  reject: (error: Error) => void;
}

export class BalancedScraperService {
  private cache = new Map<string, { data: AdvertiserStats; timestamp: number }>();
  private batchQueue: BatchRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private activeRequests = 0;
  private maxConcurrent = 20;
  private stats = {
    totalRequests: 0,
    cacheHits: 0,
    successfulScrapes: 0,
    errors: 0
  };

  constructor() {
    console.log(`⚖️ Balanced Scraper Service initialized:
    ┌─ Max Concurrent: ${this.maxConcurrent}
    ├─ Batch Size: 5
    ├─ Cache TTL: 30 minutes
    └─ Method: ScrapeCreators API (Primary)`);
  }

  async getAdvertiserStats(pageId: string, country: string = 'ALL', userId?: string): Promise<AdvertiserStatsResult> {
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

      // 2. Add to batch queue for processing
      return new Promise((resolve, reject) => {
        this.batchQueue.push({ pageId, country, userId, resolve, reject });
        
        // Process batch immediately if we have 5 requests
        if (this.batchQueue.length >= 5) {
          this.processBatch();
        } else if (!this.batchTimer) {
          // Wait up to 200ms for more requests to batch together
          this.batchTimer = setTimeout(() => this.processBatch(), 200);
        }
      });
      
    } catch (error) {
      this.stats.errors++;
      console.error(`❌ Error getting advertiser stats for ${pageId}:`, error);
      return {
        success: false,
        error: `Scraping error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionTime: Date.now() - startTime
      };
    }
  }

  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    // Clear the timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Take up to 5 requests from the queue
    const batch = this.batchQueue.splice(0, 5);
    console.log(`📦 Processing batch of ${batch.length} advertiser stats requests using ScrapeCreators`);

    try {
      // Check if ScrapeCreators is configured
      if (!scrapeCreatorsService.isConfigured()) {
        console.error(`❌ ScrapeCreators not configured, rejecting all batch requests`);
        batch.forEach(request => {
          request.reject(new Error('ScrapeCreators service not configured'));
        });
        return;
      }

      // Process all requests in the batch concurrently
      const batchPromises = batch.map(async (request) => {
        try {
          console.log(`🚀 Batch processing pageId: ${request.pageId}`);
          
          // Use ScrapeCreators as primary method
          console.log(`🔍 Calling ScrapeCreators with userId: ${request.userId || 'undefined'}`);
          const result = await scrapeCreatorsService.getAdvertiserStats(
            request.pageId, 
            request.country, 
            request.userId
          );
          
          if (result.totalActiveAds >= 0) {
            this.stats.successfulScrapes++;
            
            // Create stats object
            const stats: AdvertiserStats = {
              pageId: request.pageId,
              advertiserName: 'Unknown',
              totalActiveAds: result.totalActiveAds,
              lastUpdated: new Date().toISOString()
            };

            // Cache the result
            this.setCachedStats(`${request.pageId}:${request.country}`, stats);
            
            console.log(`✅ Batch success for ${request.pageId}: ${result.totalActiveAds} ads`);
            
            request.resolve({
              success: true,
              stats,
              executionTime: 0
            });
          } else {
            throw new Error('Invalid result from ScrapeCreators');
          }
        } catch (error) {
          this.stats.errors++;
          console.error(`❌ Batch error for ${request.pageId}:`, error);
          request.reject(error instanceof Error ? error : new Error('Unknown error'));
        }
      });

      // Wait for all requests to complete
      await Promise.allSettled(batchPromises);
      
    } catch (error) {
      console.error('❌ Batch processing error:', error);
      batch.forEach(request => {
        request.reject(error instanceof Error ? error : new Error('Batch processing failed'));
      });
    }
  }

  private getCachedStats(cacheKey: string): AdvertiserStats | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    // Check if cache is still valid (30 minutes)
    const cacheAge = Date.now() - cached.timestamp;
    if (cacheAge > 30 * 60 * 1000) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }

  private setCachedStats(cacheKey: string, stats: AdvertiserStats): void {
    this.cache.set(cacheKey, {
      data: stats,
      timestamp: Date.now()
    });
  }

  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      queueSize: this.batchQueue.length,
      activeRequests: this.activeRequests
    };
  }

  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Cache cleared');
  }
}

export const balancedScraperService = new BalancedScraperService();