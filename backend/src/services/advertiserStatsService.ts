import { htmlScraperService } from './htmlScraperService.js'

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
    console.log(`🔍 Getting stats for pageId: ${pageId} using HTTP+AI approach`);
    
    // Delegate to the new HTML scraper service
    return await htmlScraperService.getAdvertiserStats({
      pageId,
      country,
      maxRetries: 3
    });
  }

  // Legacy method for cache management
  getCacheStats() {
    return htmlScraperService.getCacheStats();
  }

  // Legacy method for cache clearing  
  clearCache() {
    htmlScraperService.clearCache();
  }
}

// Global instance
export const advertiserStatsService = new AdvertiserStatsService();