import { highConcurrencyScraperService } from './highConcurrencyScraperService.js'

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
    console.log(`🔍 Getting stats for pageId: ${pageId} using HIGH CONCURRENCY approach`);
    
    // Delegate to the high concurrency scraper service
    return await highConcurrencyScraperService.getAdvertiserStats(pageId, country);
  }

  // Performance monitoring
  getCacheStats() {
    return highConcurrencyScraperService.getPerformanceStats();
  }

  // Cache management
  clearCache() {
    highConcurrencyScraperService.clearCache();
  }
}

// Global instance
export const advertiserStatsService = new AdvertiserStatsService();