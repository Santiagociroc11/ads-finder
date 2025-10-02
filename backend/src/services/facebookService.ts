import fetch from 'node-fetch';
import { ApifyClient } from 'apify-client';
import type { 
  SearchParams, 
  AdData, 
  SearchResponse
} from '../types/shared.js';
import { AdSource } from '../types/shared.js';
import { redisCacheService } from './redisCacheService.js';

export class FacebookService {
  private readonly accessToken: string;
  private readonly apifyClient: ApifyClient | null = null;
  
  // Cache para resultados de búsqueda (para paginación inteligente)
  private searchCache = new Map<string, {
    allResults: any[];
    timestamp: number;
    searchParams: SearchParams;
  }>();

  constructor() {
    const token = process.env.FACEBOOK_ACCESS_TOKEN;
    if (!token) {
      throw new Error('FACEBOOK_ACCESS_TOKEN is required');
    }
    this.accessToken = token;

    // Initialize Apify client if token is available
    const apifyToken = process.env.APIFY_API_TOKEN;
    if (apifyToken) {
      this.apifyClient = new ApifyClient({ token: apifyToken });
    }
  }

  async searchAds(params: SearchParams): Promise<SearchResponse> {
    // Always use Apify for ads search
    if (this.apifyClient) {
      return this.searchWithApify(params);
    }
    
    throw new Error('Apify client not available - this system only supports Apify searches');
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

  private async searchWithAPI(params: SearchParams): Promise<SearchResponse> {
    const currentPage = params.page || 1;
    const pageSize = params.limit || 20;
    const cacheKey = this.generateCacheKey(params);
    
    console.log(`[API] 🚀 Executing Facebook API search (page ${currentPage})...`);
    
    try {
      let allResults: any[] = [];
      
      // Verificar cache primero
      if (this.isSearchCacheValid(cacheKey)) {
        console.log(`[API] ✅ Using cached results for pagination`);
        allResults = this.searchCache.get(cacheKey)!.allResults;
      } else {
        console.log(`[API] 🔄 Fetching fresh data from Facebook API...`);
        
        // Buscar más datos de los necesarios para futuras páginas
        const searchFields = this.getFieldsForAdType(params.adType || 'ALL');
        const endpoint = this.buildAPIEndpoint({
          ...params,
          page: 1, // Siempre empezar desde página 1 para el cache
          limit: 100 // Pedir 100 para tener datos para 5 páginas
        }, searchFields);

        const response = await fetch(endpoint);
        const data = await response.json() as any;

        if (!response.ok || data.error) {
          throw new Error(data.error?.message || 'Facebook API error');
        }

        allResults = this.processAdsData(data.data || [], AdSource.FACEBOOK_API);
        
        // Guardar en cache
        this.searchCache.set(cacheKey, {
          allResults,
          timestamp: Date.now(),
          searchParams: params
        });
        
        console.log(`[API] 💾 Cached ${allResults.length} results for future pagination`);
      }
      
      // Aplicar paginación en memoria
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedResults = allResults.slice(startIndex, endIndex);
      
      // Calcular información de paginación
      const totalResults = allResults.length;
      const totalPages = Math.ceil(totalResults / pageSize);
      const hasNextPage = endIndex < totalResults;
      const hasPrevPage = currentPage > 1;
      
      console.log(`[API] 📄 Page ${currentPage}/${totalPages}: ${paginatedResults.length} ads (${totalResults} total cached)`);
      
      return {
        data: paginatedResults,
        totalAds: paginatedResults.length,
        totalPages: totalPages,
        paging: null, // No usamos paging de Facebook
        pagination: {
          currentPage,
          totalPages,
          totalResults,
          pageSize,
          hasNextPage,
          hasPrevPage
        },
        source: 'facebook_api',
        message: `Page ${currentPage}/${totalPages}: ${paginatedResults.length} ads via Facebook API (${totalResults} total available)`
      };

    } catch (error) {
      console.error('[API] ❌ Facebook API error:', error);
      throw error;
    }
  }

  private async searchWithApify(params: SearchParams): Promise<SearchResponse> {
    if (!this.apifyClient) {
      throw new Error('Apify client not initialized');
    }

    const pageSize = params.limit || 20;
    const currentPage = params.page || 1;
    const offset = (currentPage - 1) * pageSize;
    
    console.log(`[APIFY] 💎 Executing Apify search (page ${currentPage})...`);
    
    try {
      let allProcessedAds: any[] = [];
      let fromCache = false;
      
      // Check Redis cache first
      const cachedResult = await redisCacheService.getSearchResult(params);
      if (cachedResult && cachedResult.data) {
        console.log(`[APIFY] ✅ Using Redis cached results for pagination`);
        allProcessedAds = cachedResult.data;
        fromCache = true;
      } else {
        // Fallback to local cache
        const cacheKey = this.generateCacheKey(params);
        if (this.isSearchCacheValid(cacheKey)) {
          console.log(`[APIFY] ✅ Using local cached results for pagination`);
          allProcessedAds = this.searchCache.get(cacheKey)!.allResults;
          fromCache = true;
        }
      }
      
      if (!fromCache) {
        console.log(`[APIFY] 🔄 Fetching fresh data from Apify...`);
        
        const searchUrl = this.buildApifySearchUrl(params);
        
        // Fetch ALL available results (up to apifyCount limit)
        const maxAds = params.apifyCount || 500; // Default to 500 to get comprehensive results

        const input = {
          urls: [{ url: searchUrl }],
          count: maxAds,
          period: "",
          "scrapePageAds.activeStatus": "all",
          "scrapePageAds.countryCode": params.country || "ALL"
        };

        console.log(`[APIFY] ⚙️ Running actor with ${maxAds} ads limit...`);
        
        const run = await this.apifyClient.actor("XtaWFhbtfxyzqrFmd").call(input);
        const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();

        allProcessedAds = this.processApifyData(items, params);
        
        // Cache individual ads in Redis (60 minutes TTL)
        await redisCacheService.setAds(allProcessedAds, 60);
        
        // Cache in both Redis and local cache
        const fullResult = {
          data: allProcessedAds,
          totalAds: allProcessedAds.length,
          totalPages: Math.ceil(allProcessedAds.length / pageSize),
          paging: null,
          pagination: {
            currentPage: 1,
            totalPages: Math.ceil(allProcessedAds.length / pageSize),
            totalResults: allProcessedAds.length,
            pageSize,
            hasNextPage: allProcessedAds.length > pageSize,
            hasPrevPage: false
          },
          source: 'apify_scraping',
          message: `Fresh data: ${allProcessedAds.length} ads via Apify Professional`
        };
        
        // Cache search results in Redis (30 minutes TTL)
        await redisCacheService.setSearchResult(params, fullResult, 30);
        
        // Also cache locally for immediate pagination
        const localCacheKey = this.generateCacheKey(params);
        this.searchCache.set(localCacheKey, {
          allResults: allProcessedAds,
          timestamp: Date.now(),
          searchParams: params
        });
        
        console.log(`[APIFY] 💾 Cached ${allProcessedAds.length} results + individual ads in Redis and local cache`);
      }
      
      // Apply pagination to the results
      const paginatedAds = allProcessedAds.slice(offset, offset + pageSize);
      
      // Calculate pagination info
      const totalResults = allProcessedAds.length;
      const totalPages = Math.ceil(totalResults / pageSize);
      const hasNextPage = currentPage < totalPages;
      const hasPrevPage = currentPage > 1;
      
      console.log(`[APIFY] 📄 Page ${currentPage}/${totalPages}: ${paginatedAds.length} ads (${totalResults} total available) ${fromCache ? '(from cache)' : '(fresh)'}`);

      return {
        data: paginatedAds,
        totalAds: paginatedAds.length,
        totalPages: totalPages,
        paging: null,
        pagination: {
          currentPage,
          totalPages,
          totalResults,
          pageSize,
          hasNextPage,
          hasPrevPage
        },
        source: 'apify_scraping',
        message: `Page ${currentPage}/${totalPages}: ${paginatedAds.length} ads via Apify Professional (${totalResults} total available) ${fromCache ? '(cached)' : '(fresh)'}`
      };

    } catch (error) {
      console.error('[APIFY] ❌ Apify error:', error);
      throw error;
    }
  }

  private async searchWithWebScraping(params: SearchParams): Promise<SearchResponse> {
    console.log(`[SCRAPING] 🕷️ Using enhanced web scraping...`);
    
    try {
      // Implement multiple search variations for better coverage
      const searchVariations = [
        params.value,
        params.value.split(' ')[0],
        `${params.value} ${params.country}`,
        `${params.value} oferta`,
        `${params.value} descuento`
      ];

      const allAds = new Set<string>();
      
      for (const variation of searchVariations) {
        try {
          const searchParams = this.buildAPIParams({
            ...params,
            value: variation
          });
          
          const endpoint = `https://graph.facebook.com/v23.0/ads_archive?${searchParams}&access_token=${this.accessToken}`;
          
          const response = await fetch(endpoint);
          const data = await response.json() as any;
          
          if (data.data) {
            data.data.forEach((ad: any) => {
              ad.source = 'web_scraping';
              ad.searchVariation = variation;
              ad.scraped = true;
              allAds.add(JSON.stringify(ad));
            });
          }
          
          // Pause between searches
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.warn(`[SCRAPING] Warning for variation "${variation}":`, error);
        }
      }

      const uniqueAds = Array.from(allAds).map(adStr => JSON.parse(adStr));
      const allProcessedAds = this.processAdsData(uniqueAds, AdSource.WEB_SCRAPING);
      
      // Apply pagination to the results
      const pageSize = params.limit || 20;
      const currentPage = params.page || 1;
      const offset = (currentPage - 1) * pageSize;
      const paginatedAds = allProcessedAds.slice(offset, offset + pageSize);
      
      console.log(`[SCRAPING] ✅ Found ${allProcessedAds.length} unique ads, showing page ${currentPage} (${paginatedAds.length} ads)`);

      // Calculate pagination info
      const totalResults = allProcessedAds.length;
      const totalPages = Math.ceil(totalResults / pageSize);
      const hasNextPage = currentPage < totalPages;
      const hasPrevPage = currentPage > 1;

      return {
        data: paginatedAds,
        totalAds: paginatedAds.length,
        totalPages: totalPages,
        paging: null,
        pagination: {
          currentPage,
          totalPages,
          totalResults,
          pageSize,
          hasNextPage,
          hasPrevPage
        },
        source: 'web_scraping',
        message: `Page ${currentPage}/${totalPages}: ${paginatedAds.length} ads via enhanced web scraping`
      };

    } catch (error) {
      console.error('[SCRAPING] ❌ Web scraping error:', error);
      throw error;
    }
  }

  private buildAPIEndpoint(params: SearchParams, fields: string): string {
    const searchParams = this.buildAPIParams(params);
    return `https://graph.facebook.com/v23.0/ads_archive?${searchParams}&fields=${fields}&access_token=${this.accessToken || ''}`;
  }

  private buildAPIParams(params: SearchParams): string {
    const urlParams = new URLSearchParams();
    
    urlParams.set('ad_type', params.adType || 'ALL');
    urlParams.set('ad_active_status', 'ACTIVE');
    
    // Facebook API pagination - NO usamos offset porque Facebook usa cursors
    // Como no podemos mantener cursors entre requests independientes,
    // pedimos un lote grande y paginamos en memoria
    
    const pageSize = params.limit || 20;
    
    // Pedir suficientes resultados para múltiples páginas (máximo Facebook: 100)
    urlParams.set('limit', '100');
    
    // No usamos 'after' porque requiere cursors de páginas anteriores
    // que no tenemos en requests independientes
    
    if (params.searchType === 'keyword') {
      urlParams.set('search_terms', params.value);
      urlParams.set('search_type', params.searchPhraseType === 'exact' ? 'KEYWORD_EXACT_PHRASE' : 'KEYWORD_UNORDERED');
    } else {
      urlParams.set('search_page_ids', `[${params.value}]`);
    }
    
    // Country filter
    const country = params.country || 'CO';
    urlParams.set('ad_reached_countries', `['${country}']`);
    urlParams.set('is_targeted_country', 'false');
    
    // Date filters
    if (params.dateFrom) {
      urlParams.set('ad_delivery_date_min', params.dateFrom);
    }
    if (params.dateTo) {
      urlParams.set('ad_delivery_date_max', params.dateTo);
    }
    
    // Minimum days filter
    if (params.minDays && params.minDays > 0 && !params.dateTo) {
      const today = new Date();
      const maxDate = new Date(today);
      maxDate.setDate(today.getDate() - params.minDays);
      urlParams.set('ad_delivery_date_max', maxDate.toISOString().split('T')[0]);
    }
    
    // Media type filter
    if (params.mediaType && params.mediaType !== 'ALL') {
      urlParams.set('media_type', params.mediaType);
    }
    
    // Languages filter
    if (params.languages && params.languages.length > 0) {
      const languageArray = params.languages.map((lang: any) => `'${lang}'`).join(',');
      urlParams.set('languages', `[${languageArray}]`);
    }
    
    // Platforms filter
    if (params.platforms && params.platforms.length > 0) {
      const platformArray = params.platforms.map((platform: any) => `'${platform}'`).join(',');
      urlParams.set('publisher_platforms', `[${platformArray}]`);
    }
    
    return urlParams.toString();
  }

  private buildApifySearchUrl(params: SearchParams): string {
    const baseUrl = 'https://www.facebook.com/ads/library/';
    const urlParams = new URLSearchParams();
    
    urlParams.set('active_status', 'active');
    urlParams.set('ad_type', (params.adType || 'ALL').toLowerCase());
    urlParams.set('country', params.country || 'CO');
    urlParams.set('is_targeted_country', 'false');
    urlParams.set('media_type', 'all');
    urlParams.set('q', params.value);
    urlParams.set('search_type', 'keyword_unordered');
    
    // Apply minimum days filter for Apify
    if (params.minDays && params.minDays > 0) {
      const today = new Date();
      const maxDate = new Date(today);
      maxDate.setDate(today.getDate() - params.minDays);
      urlParams.set('start_date[max]', maxDate.toISOString().split('T')[0]);
    }
    
    return `${baseUrl}?${urlParams.toString()}`;
  }

  private getFieldsForAdType(adType: string): string {
    const baseFields = 'id,ad_creation_time,ad_delivery_start_time,ad_delivery_stop_time,ad_creative_bodies,ad_creative_link_captions,ad_creative_link_descriptions,ad_creative_link_titles,ad_snapshot_url,languages,page_id,page_name,publisher_platforms';
    
    if (adType === 'POLITICAL_AND_ISSUE_ADS') {
      return `${baseFields},impressions,spend,currency,demographic_distribution,estimated_audience_size`;
    }
    
    return baseFields;
  }

  private processAdsData(rawAds: any[], source: AdSource): AdData[] {
    return rawAds.map(ad => this.processSingleAd(ad, source));
  }

  private processApifyData(items: any[], searchParams: SearchParams): AdData[] {
    return items.map((item, index) => {
      // Calculate days running from Apify data
      let daysRunning = 0;
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      
      if (item.start_date) {
        startDate = new Date(item.start_date * 1000);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - startDate.getTime());
        daysRunning = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      
      if (item.end_date) {
        endDate = new Date(item.end_date * 1000);
      }
      
      const snapshot = item.snapshot || {};
      const body = snapshot.body || {};
      
      return {
        id: item.ad_archive_id || `apify_${Date.now()}_${index}`,
        source: 'apify_scraping' as AdSource,
        scraped: true,
        
        // Basic fields
        page_name: item.page_name || snapshot.page_name || 'Unknown Page',
        page_id: item.page_id || snapshot.page_id || 'N/A',
        
        // Creative content
        ad_creative_bodies: body.text ? [body.text] : [],
        ad_creative_link_captions: snapshot.caption ? [snapshot.caption] : [],
        ad_creative_link_descriptions: snapshot.link_description ? [snapshot.link_description] : [],
        ad_creative_link_titles: snapshot.title ? [snapshot.title] : [],
        
        // Dates
        ad_creation_time: startDate?.toISOString() || null,
        ad_delivery_start_time: startDate?.toISOString() || null,
        ad_delivery_stop_time: endDate?.toISOString() || null,
        
        // URLs and platforms - generate correct URL with search country
        ad_snapshot_url: this.generateAdLibraryUrl(item.ad_archive_id || `apify_${Date.now()}_${index}`, searchParams.country || 'CO', searchParams),
        publisher_platforms: item.publisher_platform ? [item.publisher_platform] : [],
        languages: [],
        
        // Metrics (Apify specific)
        impressions: item.impressions_with_index?.impressions_text ? {
          lower_bound: item.impressions_with_index.impressions_text,
          upper_bound: item.impressions_with_index.impressions_text
        } : undefined,
        spend: item.spend ? {
          lower_bound: item.spend.toString(),
          currency: item.currency || 'USD'
        } : undefined,
        currency: item.currency || 'USD',
        
        // Calculated fields
        days_running: daysRunning,
        is_long_running: daysRunning > 30,
        is_indefinite: !endDate,
        is_active: item.is_active || false,
        total_active_time: item.total_active_time || 0,
        
        // Hotness scoring
        collation_count: item.collation_count || 1,
        hotness_score: this.calculateHotnessScore(item.collation_count || 1, daysRunning),
        
        // Apify specific data
        apify_data: {
          ad_library_url: this.generateAdLibraryUrl(item.ad_archive_id || `apify_${Date.now()}_${index}`, searchParams.country || 'CO', searchParams),
          page_profile_uri: snapshot.page_profile_uri,
          link_url: snapshot.link_url,
          images: snapshot.images || [],
          videos: snapshot.videos || [],
          page_profile_picture_url: snapshot.page_profile_picture_url,
          video_preview_image_url: snapshot.videos?.[0]?.video_preview_image_url,
          page_categories: snapshot.page_categories || [],
          page_like_count: snapshot.page_like_count || 0,
          ig_followers: 0,
          ig_username: null,
          page_verification: false,
          display_format: snapshot.display_format,
          cta_text: snapshot.cta_text,
          cta_type: snapshot.cta_type,
          reach_estimate: item.reach_estimate,
          contains_sensitive_content: item.contains_sensitive_content,
          start_date_formatted: item.start_date_formatted,
          end_date_formatted: item.end_date_formatted,
          total_ads_from_page: item.total,
          ads_count: item.ads_count,
          entity_type: item.entity_type,
          gated_type: item.gated_type,
          original_item: item
        }
      } satisfies AdData;
    });
  }

  private processSingleAd(ad: any, source: AdSource): AdData {
    // Calculate days running
    let daysRunning = 0;
    if (ad.ad_delivery_start_time) {
      const startDate = new Date(ad.ad_delivery_start_time);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - startDate.getTime());
      daysRunning = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return {
      id: ad.id || 'N/A',
      source,
      scraped: source !== 'facebook_api',
      
      // Basic fields
      page_name: ad.page_name || 'Unknown Page',
      page_id: ad.page_id || 'N/A',
      
      // Creative content
      ad_creative_bodies: ad.ad_creative_bodies || [],
      ad_creative_link_captions: ad.ad_creative_link_captions || [],
      ad_creative_link_descriptions: ad.ad_creative_link_descriptions || [],
      ad_creative_link_titles: ad.ad_creative_link_titles || [],
      
      // Dates
      ad_creation_time: ad.ad_creation_time || null,
      ad_delivery_start_time: ad.ad_delivery_start_time || null,
      ad_delivery_stop_time: ad.ad_delivery_stop_time || null,
      
      // URLs and platforms
      ad_snapshot_url: ad.ad_snapshot_url || '',
      publisher_platforms: ad.publisher_platforms || [],
      languages: ad.languages || [],
      
      // Metrics
      impressions: ad.impressions,
      spend: ad.spend,
      currency: ad.currency,
      
      // Calculated fields
      days_running: daysRunning,
      is_long_running: daysRunning > 30,
      is_indefinite: !ad.ad_delivery_stop_time,
      is_active: true,
      
      // Hotness scoring
      collation_count: ad.collation_count || 1,
      hotness_score: this.calculateHotnessScore(ad.collation_count || 1, daysRunning),
    } satisfies AdData;
  }

  private calculateHotnessScore(collationCount: number, daysRunning: number): number {
    // Score base por collation_count (cuantas variaciones tiene)
    let baseScore = Math.min(collationCount * 10, 100);
    
    // Bonus por días corriendo (productos que duran son exitosos)
    let durationBonus = 0;
    if (daysRunning > 30) durationBonus = 30;
    else if (daysRunning > 15) durationBonus = 20;
    else if (daysRunning > 7) durationBonus = 10;
    
    const totalScore = baseScore + durationBonus;
    
    // Normalizar a escala 1-5
    return Math.min(Math.max(Math.round(totalScore / 25), 1), 5);
  }

  generateAdLibraryUrl(adId: string, country: string, searchParams?: SearchParams): string {
    const baseUrl = 'https://www.facebook.com/ads/library/';
    const urlParams = new URLSearchParams();
    
    urlParams.set('active_status', 'active');
    urlParams.set('ad_type', (searchParams?.adType || 'ALL').toLowerCase());
    urlParams.set('country', country);
    urlParams.set('is_targeted_country', 'false');
    urlParams.set('media_type', 'all');
    urlParams.set('search_type', 'keyword_unordered');
    
    // Add search term if available
    if (searchParams?.value) {
      urlParams.set('q', searchParams.value);
    }
    
    // Add minimum days filter if available
    if (searchParams?.minDays && searchParams.minDays > 0) {
      const today = new Date();
      const maxDate = new Date(today);
      maxDate.setDate(today.getDate() - searchParams.minDays);
      urlParams.set('start_date[max]', maxDate.toISOString().split('T')[0]);
    }
    
    return `${baseUrl}?${urlParams.toString()}`;
  }

  async fetchMultiplePages(initialEndpoint: string, maxPages: number = 5): Promise<SearchResponse> {
    const allResults: any[] = [];
    let currentUrl: string | null = initialEndpoint;
    let pageCount = 0;
    let totalCount = 0;

    while (currentUrl && pageCount < maxPages) {
      try {
        console.log(`[API] 📄 Fetching page ${pageCount + 1}/${maxPages}...`);
        
        const response = await fetch(currentUrl);
        const data = await response.json() as any;

        if (!response.ok || data.error) {
          console.error(`[API] ❌ Error on page ${pageCount + 1}:`, data.error);
          break;
        }

        if (data.data && data.data.length > 0) {
          allResults.push(...data.data);
          totalCount += data.data.length;
          console.log(`[API] ✅ Page ${pageCount + 1}: ${data.data.length} ads. Total: ${totalCount}`);
        }

        currentUrl = data.paging?.next || null;
        pageCount++;

        // Pause between requests
        if (currentUrl && pageCount < maxPages) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        console.error(`[API] ❌ Error fetching page ${pageCount + 1}:`, error);
        break;
      }
    }

    const processedAds = this.processAdsData(allResults, AdSource.FACEBOOK_API);
    
    return {
      data: processedAds,
      totalAds: totalCount,
      totalPages: pageCount,
      paging: currentUrl ? { next: currentUrl } : null,
      source: 'facebook_api',
      message: `Fetched ${totalCount} ads across ${pageCount} pages`
    };
  }
}
