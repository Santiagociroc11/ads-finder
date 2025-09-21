import { balancedScraperService } from './balancedScraperService.js'

export interface AdvertiserStats {
  pageId: string
  advertiserName: string
  totalActiveAds: number
  lastUpdated: string
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
      const result = await balancedScraperService.getAdvertiserStats(pageId, country);
      
      if (result.success) {
        console.log(`✅ Balanced scraper successful: ${result.stats?.totalActiveAds || 0} ads`);
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