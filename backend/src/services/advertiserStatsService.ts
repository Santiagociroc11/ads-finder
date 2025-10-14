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

export class AdvertiserStatsService {
  async getAdvertiserStats(pageId: string, country: string = 'ALL'): Promise<AdvertiserStatsResult> {
    console.log(`🔍 Getting stats for pageId: ${pageId} using SCRAPECREATORS approach`);
    
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

      // Use ScrapeCreators directly for faster results
      const { scrapeCreatorsService } = await import('./scrapeCreatorsService.js');
      
      if (!scrapeCreatorsService.isConfigured()) {
        console.error(`❌ ScrapeCreators not configured for ${pageId}`);
        return {
          success: false,
          error: 'ScrapeCreators service not configured',
          executionTime: 0
        };
      }

      console.log(`🚀 Using ScrapeCreators for fast stats retrieval: ${pageId}`);
      const result = await scrapeCreatorsService.getAdvertiserStats(pageId, country);
      
      if (result.totalActiveAds >= 0) {
        console.log(`✅ ScrapeCreators successful: ${result.totalActiveAds} ads for ${pageId}`);
        
        const stats: AdvertiserStats = {
          pageId,
          advertiserName: 'Unknown',
          totalActiveAds: result.totalActiveAds,
          lastUpdated: new Date().toISOString()
        };
        
        // Cache the result in Redis
        await redisCacheService.setAdvertiserStats(
          pageId, 
          country, 
          { 
            totalActiveAds: result.totalActiveAds, 
            loading: false 
          }, 
          15 // 15 minutes TTL
        );
        
        return {
          success: true,
          stats,
          executionTime: 0
        };
      } else {
        console.error(`❌ ScrapeCreators failed for ${pageId}`);
        return {
          success: false,
          error: 'ScrapeCreators returned invalid data',
          executionTime: 0
        };
      }
      
    } catch (error) {
      console.error(`❌ ScrapeCreators failed for ${pageId}:`, error);
      return {
        success: false,
        error: `ScrapeCreators failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionTime: 0
      };
    }
  }

  // Performance monitoring
  getCacheStats() {
    return {
      service: 'ScrapeCreators',
      message: 'Using ScrapeCreators for fast advertiser stats retrieval'
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