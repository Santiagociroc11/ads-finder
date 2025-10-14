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
    const startTime = Date.now();
    console.log(`[AdvertiserStatsService] ENTERING getAdvertiserStats for pageId: ${pageId}, received userId: ${userId} (Processing ONE-BY-ONE)`);

    try {
      // 1. Check Redis cache first
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
          executionTime: Date.now() - startTime
        };
      }

      // 2. Import ScrapeCreators service
      const { scrapeCreatorsService } = await import('./scrapeCreatorsService.js');
      if (!scrapeCreatorsService.isConfigured()) {
        throw new Error('ScrapeCreators service not configured');
      }

      // 3. Call the service directly
      console.log(`[AdvertiserStatsService] Calling scrapeCreatorsService.getAdvertiserStats for pageId: ${pageId}, passing userId: ${userId}`);
      const result = await scrapeCreatorsService.getAdvertiserStats(pageId, country, userId);
      const executionTime = Date.now() - startTime;

      if (result.totalActiveAds >= 0) {
        console.log(`✅ Successfully fetched stats for ${pageId}: ${result.totalActiveAds} ads in ${executionTime}ms`);
        
        const stats: AdvertiserStats = {
          pageId: pageId,
          advertiserName: 'Unknown', // This data is not returned by this specific service endpoint
          totalActiveAds: result.totalActiveAds,
          lastUpdated: new Date().toISOString()
        };

        // 4. Cache the result in Redis
        await redisCacheService.setAdvertiserStats(
          pageId,
          country,
          { totalActiveAds: result.totalActiveAds, loading: false },
          15 * 60 // 15 minutes TTL
        );

        return { success: true, stats, executionTime };
      } else {
        throw new Error('ScrapeCreators returned invalid data');
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ Error in getAdvertiserStats for ${pageId}:`, error);
      return {
        success: false,
        error: `Failed to get stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionTime
      };
    }
  }

  private async processBatch(): Promise<void> {
    // This method is no longer used and can be removed.
    // Kept here to avoid breaking changes if called elsewhere, but it does nothing.
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