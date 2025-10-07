import { balancedScraperService } from './balancedScraperService.js'
import { redisCacheService } from './redisCacheService.js'

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
    console.log(`🔍 Getting stats for pageId: ${pageId} using BALANCED SCRAPER approach`);
    
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

      // If not in Redis cache, use balanced scraper
      const result = await balancedScraperService.getAdvertiserStats(pageId, country);
      
      if (result.success && result.stats) {
        console.log(`✅ Balanced scraper successful: ${result.stats.totalActiveAds || 0} ads`);
        
        // Cache the result in Redis
        await redisCacheService.setAdvertiserStats(
          pageId, 
          country, 
          { 
            totalActiveAds: result.stats.totalActiveAds, 
            loading: false 
          }, 
          15 // 15 minutes TTL
        );
      }
      
      return result;
      
    } catch (error) {
      console.error(`❌ Balanced scraper failed for ${pageId}:`, error);
      return {
        success: false,
        error: `Balanced scraper failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionTime: 0
      };
    }
  }

  // Performance monitoring
  getCacheStats() {
    return balancedScraperService.getPerformanceStats();
  }

  // Cache management
  clearCache() {
    balancedScraperService.clearCache();
  }
}

// Global instance
export const advertiserStatsService = new AdvertiserStatsService();