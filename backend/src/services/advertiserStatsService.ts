import { balancedScraperService } from './balancedScraperService.js'
import { redisCacheService } from './redisCacheService.js'
import { storageService } from './storageService.js'

export interface AdvertiserStats {
  pageId: string
  advertiserName: string
  totalActiveAds: number
  lastUpdated: string
  // Profile information
  pageProfilePictureUrl?: string
  pageProfileUri?: string
  pageLikeCount?: number
  pageCategories?: string[]
  pageVerification?: boolean
}

export interface AdvertiserStatsResult {
  success: boolean
  stats?: AdvertiserStats
  error?: string
  executionTime: number
}

interface BatchRequest {
  pageId: string;
  country: string;
  userId?: string;
  resolve: (result: AdvertiserStatsResult) => void;
  reject: (error: Error) => void;
}

export class AdvertiserStatsService {
  private batchQueue: BatchRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessingBatch = false;

  async getAdvertiserStats(pageId: string, country: string = 'ALL', userId?: string): Promise<AdvertiserStatsResult> {
    console.log(`🔍 Getting stats for pageId: ${pageId} using SCRAPECREATORS BATCH approach`);
    
    try {
      // Check Redis cache first
      const cachedStats = await redisCacheService.getAdvertiserStats(pageId, country);
      if (cachedStats) {
        console.log(`✅ Redis cache hit for ${pageId}: ${cachedStats.totalActiveAds} ads`);
        return {
          success: true,
          stats: {
            pageId,
            advertiserName: 'Cached',
            totalActiveAds: cachedStats.totalActiveAds,
            lastUpdated: new Date().toISOString()
          },
          executionTime: 0
        };
      }

      // Add to batch queue for processing
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
      console.error(`❌ Error adding to batch queue for ${pageId}:`, error);
      return {
        success: false,
        error: `Batch processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionTime: 0
      };
    }
  }

  private async processBatch(): Promise<void> {
    if (this.isProcessingBatch || this.batchQueue.length === 0) return;

    this.isProcessingBatch = true;
    
    // Clear the timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Take up to 5 requests from the queue
    const batch = this.batchQueue.splice(0, 5);
    console.log(`📦 Processing batch of ${batch.length} advertiser stats requests`);

    try {
      // Import ScrapeCreators service
      const { scrapeCreatorsService } = await import('./scrapeCreatorsService.js');
      
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
          console.log(`[AdvertiserStatsService] Processing batch for pageId: ${request.pageId}, passing userId: ${request.userId}`);
          const result = await scrapeCreatorsService.getAdvertiserStats(request.pageId, request.country, request.userId);
          
          if (result.totalActiveAds >= 0) {
            console.log(`✅ Batch successful for ${request.pageId}: ${result.totalActiveAds} ads`);
            
            const stats: AdvertiserStats = {
              pageId: request.pageId,
              advertiserName: 'Unknown',
              totalActiveAds: result.totalActiveAds,
              lastUpdated: new Date().toISOString()
            };
            
            // Cache the result in Redis
            await redisCacheService.setAdvertiserStats(
              request.pageId, 
              request.country, 
              { 
                totalActiveAds: result.totalActiveAds, 
                loading: false 
              }, 
              15 // 15 minutes TTL
            );
            
            request.resolve({
              success: true,
              stats,
              executionTime: 0
            });
          } else {
            console.error(`❌ Batch failed for ${request.pageId}: invalid data`);
            request.resolve({
              success: false,
              error: 'ScrapeCreators returned invalid data',
              executionTime: 0
            });
          }
        } catch (error) {
          console.error(`❌ Batch error for ${request.pageId}:`, error);
          request.resolve({
            success: false,
            error: `ScrapeCreators failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            executionTime: 0
          });
        }
      });

      // Wait for all batch requests to complete
      await Promise.allSettled(batchPromises);
      console.log(`✅ Batch processing completed for ${batch.length} requests`);

    } catch (error) {
      console.error(`❌ Batch processing failed:`, error);
      batch.forEach(request => {
        request.resolve({
          success: false,
          error: `Batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          executionTime: 0
        });
      });
    } finally {
      this.isProcessingBatch = false;
      
      // Process remaining requests if any
      if (this.batchQueue.length > 0) {
        this.processBatch();
      }
    }
  }

  // Performance monitoring
  getCacheStats() {
    return {
      service: 'ScrapeCreators',
      batchProcessing: true,
      batchSize: 5,
      queueLength: this.batchQueue.length,
      isProcessing: this.isProcessingBatch,
      message: 'Using ScrapeCreators with batch processing (5 requests per batch)'
    };
  }

  // Batch statistics
  getBatchStats() {
    return {
      queueLength: this.batchQueue.length,
      isProcessing: this.isProcessingBatch,
      batchSize: 5,
      pendingRequests: this.batchQueue.map(req => req.pageId)
    };
  }

  // Cache management
  async clearCache() {
    // Note: Redis cache will expire automatically based on TTL
    // For manual clearing, we would need to implement a clear method in RedisCacheService
    console.log('ℹ️ Advertiser stats cache will expire automatically based on TTL (15 minutes)');
  }

  /**
   * Process and upload profile image to MinIO
   */
  async processProfileImage(profileImageUrl: string, pageId: string): Promise<string | null> {
    if (!profileImageUrl) return null;

    try {
      console.log(`🖼️ Processing profile image for pageId: ${pageId}`);
      
      const uploadResult = await storageService.uploadMediaFromUrl(
        profileImageUrl, 
        `advertisers/${pageId}/profile`
      );

      if (uploadResult.success && uploadResult.url) {
        console.log(`✅ Profile image uploaded to MinIO: ${uploadResult.url}`);
        return uploadResult.url;
      } else {
        console.error(`❌ Failed to upload profile image: ${uploadResult.error}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error processing profile image:`, error);
      return null;
    }
  }
}

// Global instance
export const advertiserStatsService = new AdvertiserStatsService();