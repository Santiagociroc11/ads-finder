import type { 
  SearchParams, 
  AdData, 
  SearchResponse
} from '../types/shared.js';
import { AdSource } from '../types/shared.js';
import { redisCacheService } from './redisCacheService.js';
import { scrapeCreatorsService } from './scrapeCreatorsService.js';

export class FacebookService {
  // Cache para resultados de búsqueda (para paginación inteligente)
  private searchCache = new Map<string, {
    allResults: any[];
    timestamp: number;
    searchParams: SearchParams;
  }>();

  constructor() {
    // Only ScrapeCreators - no other dependencies needed
  }

  async searchAds(params: SearchParams): Promise<SearchResponse> {
    // Only use ScrapeCreators for ads search
    if (!scrapeCreatorsService.isConfigured()) {
      throw new Error('ScrapeCreators API not configured - please add SCRAPECREATORS_API_KEY to your .env file');
    }
    
    return this.searchWithScrapeCreators(params);
  }

  private generateCacheKey(params: SearchParams): string {
    // Clave basada en parámetros de búsqueda (sin page/limit para compartir cache)
    const { page, limit, offset, ...searchParams } = params;
    return JSON.stringify(searchParams);
  }

  private isSearchCacheValid(cacheKey: string): boolean {
    const cached = this.searchCache.get(cacheKey);
    if (!cached) return false;
    
    // Cache válido por 10 minutos
    const CACHE_TTL = 10 * 60 * 1000;
    return (Date.now() - cached.timestamp) < CACHE_TTL;
  }

  private async searchWithScrapeCreators(params: SearchParams): Promise<SearchResponse> {
    const pageSize = 30; // ScrapeCreators returns 30 ads per page
    const currentPage = params.page || 1;
    
    console.log(`[SCRAPECREATORS] 🔍 Executing ScrapeCreators search (page ${currentPage})...`);
    
    try {
      // Get cursor from params (for pagination)
      const cursor = (params as any).cursor || undefined;
      
      console.log(`[SCRAPECREATORS] 🔄 Fetching page ${currentPage} from ScrapeCreators API...${cursor ? ' (with cursor)' : ' (initial search)'}`);
      
      // Fetch ONLY one page from ScrapeCreators
      const result = await scrapeCreatorsService.searchAds(params, cursor);
      
      console.log(`[SCRAPECREATORS] ✅ Received ${result.ads.length} ads (total available: ${result.totalResults})`);
      
      // Process ads to calculate hotness scores, etc.
      const processedAds = this.processAdsData(result.ads, 'scrapecreators_api' as AdSource);
      
      // Cache individual ads in Redis (60 minutes TTL)
      await redisCacheService.setAds(processedAds, 60);
      
      // Calculate if there are more pages
      const hasMore = result.hasMore && !!result.cursor;
      
      console.log(`[SCRAPECREATORS] 📄 Page ${currentPage}: ${processedAds.length} ads | HasMore: ${hasMore} | NextCursor: ${result.cursor ? 'yes' : 'no'}`);
      
      return {
        data: processedAds,
        totalAds: result.totalResults,
        totalPages: Math.ceil(result.totalResults / pageSize),
        paging: null,
        pagination: {
          currentPage,
          totalPages: Math.ceil(result.totalResults / pageSize),
          totalResults: result.totalResults,
          pageSize,
          hasNextPage: hasMore,
          hasPrevPage: currentPage > 1
        },
        source: 'scrapecreators_api' as AdSource,
        message: `Page ${currentPage}: ${processedAds.length} ads via ScrapeCreators`,
        cursor: result.cursor || undefined // Return cursor for next page
      };
      
    } catch (error: any) {
      console.error('[SCRAPECREATORS] ❌ Error:', error.message);
      throw error;
    }
  }

  /**
   * Process ads data to calculate hotness scores and other metrics
   */
  private processAdsData(rawAds: any[], source: AdSource): AdData[] {
    return rawAds.map(ad => {
      // Calculate hotness score based on collation_count
      const hotnessScore = Math.min(ad.collation_count || 1, 100);
      const flameEmoji = hotnessScore >= 50 ? '🔥' : hotnessScore >= 20 ? '🔥' : '';

      return {
        ...ad,
        source,
        scraped: true,
        hotness_score: hotnessScore,
        flame_emoji: flameEmoji
      };
    });
  }

  /**
   * Get advertiser stats using ScrapeCreators company ads endpoint
   */
  async getAdvertiserStats(pageId: string, country?: string): Promise<{
    totalActiveAds: number;
    ads: AdData[];
  }> {
    try {
      console.log(`[FACEBOOK_SERVICE] 📊 Getting stats for pageId: ${pageId} using ScrapeCreators`);
      
      // Use ScrapeCreators service to get real advertiser stats
      const stats = await scrapeCreatorsService.getAdvertiserStats(pageId, country);
      
      console.log(`[FACEBOOK_SERVICE] ✅ Retrieved stats: ${stats.totalActiveAds} active ads`);
      
      return stats;

    } catch (error: any) {
      console.error('[FACEBOOK_SERVICE] ❌ Error getting advertiser stats:', error.message);
      throw error;
    }
  }
}

export const facebookService = new FacebookService();