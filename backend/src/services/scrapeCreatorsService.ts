import axios from 'axios';
import type { AdData, SearchParams } from '@/types/shared.js';

const SCRAPECREATORS_API_URL = 'https://api.scrapecreators.com/v1/facebook/adLibrary/search/ads';
const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY || '';

interface ScrapeCreatorsResponse {
  searchResults: Array<{
    ad_archive_id: string;
    ad_id: string | null;
    archive_types: string[];
    categories: string[];
    collation_count: number;
    collation_id: string;
    contains_digital_created_media: boolean;
    contains_sensitive_content: boolean;
    currency: string;
    end_date: number;
    entity_type: string;
    gated_type: string;
    has_user_reported: boolean;
    hidden_safety_data: boolean;
    hide_data_status: string;
    impressions_with_index: {
      impressions_text: string | null;
      impressions_index: number;
    };
    is_aaa_eligible: boolean;
    is_active: boolean;
    is_profile_page: boolean;
    menu_items: any[];
    page_id: string;
    page_is_deleted: boolean;
    page_name: string;
    political_countries: string[];
    publisher_platform: string[];
    reach_estimate: any;
    snapshot: {
      body: {
        text: string;
      };
      branded_content: any;
      brazil_tax_id: any;
      byline: any;
      caption: any;
      cards: any[];
      cta_text: string;
      cta_type: string;
      country_iso_code: string | null;
      current_page_name: string;
      disclaimer_label: any;
      display_format: string;
      event: any;
      images: Array<{
        original_image_url: string;
        resized_image_url: string;
        watermarked_resized_image_url: string;
        image_crops: any[];
      }>;
      is_reshared: boolean;
      link_description: string | null;
      link_url: string | null;
      page_categories: string[];
      page_entity_type: string;
      page_id: string;
      page_is_deleted: boolean;
      page_is_profile_page: boolean;
      page_like_count: number;
      page_name: string;
      page_profile_picture_url: string;
      page_profile_uri: string;
      root_reshared_post: any;
      title: string | null;
      videos: any[];
      additional_info: any;
      ec_certificates: any[];
      extra_images: any[];
      extra_links: any[];
      extra_texts: any[];
      extra_videos: any[];
    };
    spend: any;
    start_date: number;
    state_media_run_label: any;
    targeted_or_reached_countries: string[];
    total_active_time: number;
  }>;
  searchResultsCount: number;
  cursor: string;
}

export class ScrapeCreatorsService {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = SCRAPECREATORS_API_KEY;
    this.apiUrl = SCRAPECREATORS_API_URL;

    if (!this.apiKey) {
      console.warn('⚠️ SCRAPECREATORS_API_KEY not found in environment variables');
    }
  }

  /**
   * Search ads using ScrapeCreators API
   */
  async searchAds(searchParams: SearchParams, cursor?: string, userId?: string): Promise<{
    ads: AdData[];
    cursor: string | null;
    totalResults: number;
    hasMore: boolean;
  }> {
    try {
      console.log(`[SCRAPECREATORS] 🔍 Searching ads: "${searchParams.value}" (cursor: ${cursor ? 'yes' : 'no'})`);

      // Map search params to ScrapeCreators format
      const params: any = {
        query: searchParams.value,
        search_type: this.mapSearchPhraseType(searchParams.searchPhraseType),
        country: searchParams.country?.toUpperCase() || 'ALL',
        status: 'ACTIVE', // Always search for active ads
        trim: true // Get trimmed version for better performance
      };

      // Add media type if specified
      if (searchParams.mediaType && searchParams.mediaType !== 'ALL') {
        params.media_type = this.mapMediaType(searchParams.mediaType);
      }

      // Add ad type if specified
      if (searchParams.adType && searchParams.adType !== 'ALL') {
        params.ad_type = this.mapAdType(searchParams.adType);
      }

      // Add date range if minDays is specified
      if (searchParams.minDays && searchParams.minDays > 0) {
        // Para "días mínimos", usamos end_date para filtrar anuncios que han estado
        // activos desde al menos esa fecha hacia atrás
        const minEndDate = new Date();
        minEndDate.setDate(minEndDate.getDate() - searchParams.minDays);
        
        // Solo establecemos end_date, no start_date
        // Esto trae anuncios que han estado activos desde al menos minDays días atrás
        params.end_date = minEndDate.toISOString().split('T')[0]; // YYYY-MM-DD
        console.log(`[SCRAPECREATORS] 📅 Filtering ads active since at least ${searchParams.minDays} days ago (${params.end_date})`);
      }

      // Add cursor for pagination
      if (cursor) {
        params.cursor = cursor;
      }

      // Debug: Log the final parameters being sent
      console.log('[SCRAPECREATORS] 📤 Sending parameters:', JSON.stringify(params, null, 2));

      // Make API request
      const response = await axios.get<ScrapeCreatorsResponse>(this.apiUrl, {
        headers: {
          'x-api-key': this.apiKey
        },
        params,
        timeout: 30000 // 30 seconds timeout
      });

      console.log(`[SCRAPECREATORS] ✅ Received ${response.data.searchResults.length} ads (total: ${response.data.searchResultsCount})`);

      // Track credits usage
      if (userId) {
        try {
          const { creditsTrackingService } = await import('./creditsTrackingService.js');
          await creditsTrackingService.trackCreditsUsage(userId, 1);
        } catch (error) {
          console.error('❌ Error tracking credits for search:', error);
        }
      }

      // Transform results to our AdData format
      const ads = this.transformResults(response.data.searchResults, searchParams);

      return {
        ads,
        cursor: response.data.cursor || null,
        totalResults: response.data.searchResultsCount,
        hasMore: response.data.cursor !== null && response.data.cursor !== undefined
      };

    } catch (error: any) {
      console.error('[SCRAPECREATORS] ❌ Error searching ads:', error.message);
      
      if (error.response) {
        console.error('[SCRAPECREATORS] Response error:', {
          status: error.response.status,
          data: error.response.data
        });
      }

      throw new Error(`ScrapeCreators API error: ${error.message}`);
    }
  }


  /**
   * Transform ScrapeCreators results to our AdData format
   */
  private transformResults(results: ScrapeCreatorsResponse['searchResults'], searchParams: SearchParams): AdData[] {
    return results.map(ad => {
      // Extract media URLs - prioritize resized for better performance
      const images = ad.snapshot.images.map(img => ({
        url: img.resized_image_url || img.original_image_url,
        original_url: img.original_image_url,
        resized_url: img.resized_image_url,
        watermarked_url: img.watermarked_resized_image_url || null,
        crops: img.image_crops || []
      }));
      const videos = ad.snapshot.videos || [];

      // Generate ad library URL
      const adLibraryUrl = this.generateAdLibraryUrl(ad.ad_archive_id, searchParams.country);

      return {
        id: ad.ad_archive_id,
        source: 'scrapecreators_api',
        scraped: true,
        page_id: ad.page_id,
        page_name: ad.page_name || ad.snapshot.page_name,
        ad_creative_bodies: [ad.snapshot.body?.text || ''],
        ad_creative_link_captions: [ad.snapshot.link_description || ''],
        ad_creative_link_descriptions: [],
        ad_creative_link_titles: [ad.snapshot.title || ''],
        ad_creation_time: null,
        ad_delivery_start_time: ad.start_date ? new Date(ad.start_date * 1000).toISOString() : '',
        ad_delivery_stop_time: ad.end_date ? new Date(ad.end_date * 1000).toISOString() : null,
        ad_snapshot_url: adLibraryUrl,
        publisher_platforms: ad.publisher_platform || [],
        languages: ['es'], // Default to Spanish
        days_running: ad.start_date && ad.end_date ? 
          Math.floor((ad.end_date - ad.start_date) / 86400) : 
          (ad.start_date ? Math.floor((Date.now() / 1000 - ad.start_date) / 86400) : 0),
        is_long_running: ad.total_active_time ? ad.total_active_time > (7 * 86400) : false,
        is_indefinite: !ad.end_date,
        is_active: ad.is_active,
        total_active_time: ad.total_active_time,
        collation_count: ad.collation_count || 1,
        hotness_score: 0, // Will be calculated later
        flame_emoji: '',
        
        // Map to apify_data for frontend compatibility
        apify_data: {
          ad_library_url: adLibraryUrl,
          page_profile_uri: ad.snapshot.page_profile_uri,
          link_url: ad.snapshot.link_url || undefined,
          images: images.map(img => img.url), // Extract just the URLs for compatibility
          videos: videos.map(v => ({
            video_preview_image_url: v.video_preview_image_url || undefined,
            video_hd_url: v.video_hd_url || undefined,
            video_sd_url: v.video_sd_url || undefined,
            watermarked_video_hd_url: v.watermarked_video_hd_url || undefined,
            watermarked_video_sd_url: v.watermarked_video_sd_url || undefined
          })),
          page_profile_picture_url: ad.snapshot.page_profile_picture_url,
          video_preview_image_url: videos[0]?.video_preview_image_url || undefined,
          page_categories: ad.snapshot.page_categories,
          page_like_count: ad.snapshot.page_like_count,
          ig_followers: 0, // Not available in ScrapeCreators
          ig_username: null,
          page_verification: false, // Not available in ScrapeCreators
          display_format: ad.snapshot.display_format,
          cta_text: ad.snapshot.cta_text,
          cta_type: ad.snapshot.cta_type,
          reach_estimate: ad.reach_estimate || undefined,
          contains_sensitive_content: ad.contains_sensitive_content,
          start_date_formatted: ad.start_date ? new Date(ad.start_date * 1000).toLocaleDateString('es-ES') : undefined,
          end_date_formatted: ad.end_date ? new Date(ad.end_date * 1000).toLocaleDateString('es-ES') : undefined,
          total_ads_from_page: ad.collation_count || 1, // Use collation_count as total ads
          ads_count: ad.collation_count || 1,
          entity_type: ad.entity_type,
          gated_type: ad.gated_type,
          original_item: ad // Store original for debugging
        },
        
        // Additional data from ScrapeCreators (keep for future use)
        scrapecreators_data: {
          collation_id: ad.collation_id,
          collation_count: ad.collation_count,
          categories: ad.categories,
          entity_type: ad.entity_type,
          is_active: ad.is_active,
          page_profile_uri: ad.snapshot.page_profile_uri,
          page_profile_picture_url: ad.snapshot.page_profile_picture_url,
          page_like_count: ad.snapshot.page_like_count,
          page_categories: ad.snapshot.page_categories,
          total_active_time: ad.total_active_time,
          impressions_text: ad.impressions_with_index?.impressions_text || null,
          contains_digital_created_media: ad.contains_digital_created_media,
          contains_sensitive_content: ad.contains_sensitive_content,
          targeted_countries: ad.targeted_or_reached_countries,
          // Detailed image information
          images_detailed: images,
          // Additional snapshot data
          link_description: ad.snapshot.link_description,
          link_url: ad.snapshot.link_url,
          title: ad.snapshot.title,
          caption: ad.snapshot.caption,
          cta_text: ad.snapshot.cta_text,
          cta_type: ad.snapshot.cta_type,
          display_format: ad.snapshot.display_format
        }
      };
    });
  }

  /**
   * Map our search phrase type to ScrapeCreators format
   */
  private mapSearchPhraseType(phraseType?: string): string {
    if (phraseType === 'exact') {
      return 'keyword_exact_phrase';
    }
    return 'keyword_unordered'; // default
  }

  /**
   * Map our media type to ScrapeCreators format
   */
  private mapMediaType(mediaType: string): string {
    const mapping: { [key: string]: string } = {
      'IMAGE': 'IMAGE',
      'VIDEO': 'VIDEO',
      'MEME': 'MEME', // Text + Image
      'ALL': 'ALL'
    };
    return mapping[mediaType] || 'ALL';
  }

  /**
   * Map our ad type to ScrapeCreators format
   */
  private mapAdType(adType: string): string {
    const mapping: { [key: string]: string } = {
      'ALL': 'ALL',
      'POLITICAL_AND_ISSUE_ADS': 'POLITICAL_AND_ISSUE_ADS'
    };
    return mapping[adType] || 'ALL';
  }

  /**
   * Generate Facebook Ad Library URL
   */
  private generateAdLibraryUrl(adArchiveId: string, country?: string): string {
    const countryCode = country?.toUpperCase() || 'ALL';
    return `https://www.facebook.com/ads/library/?id=${adArchiveId}&country=${countryCode}`;
  }

  /**
   * Get advertiser stats (active ads count) with credit tracking
   */
  async getAdvertiserStats(pageId: string, country?: string, userId?: string): Promise<{
    totalActiveAds: number;
    ads: AdData[];
  }> {
    try {
      console.log(`[SCRAPECREATORS] LOGGING: Executing getAdvertiserStats WITH credit tracking for userId: ${userId}`);
      console.log(`[SCRAPECREATORS] 📊 Getting stats for pageId: ${pageId}, country: ${country || 'ALL'}`);
      
      const companyAdsUrl = `${this.apiUrl.replace('/search/ads', '/company/ads')}`;
      
      const response = await axios.get(companyAdsUrl, {
        headers: {
          'x-api-key': this.apiKey
        },
        params: {
          pageId: pageId,
          country: country?.toUpperCase() || 'ALL',
          status: 'ACTIVE',
          media_type: 'ALL'
        },
        timeout: 30000 // 30 seconds timeout
      });

      const totalActiveAds = response.data.searchResultsCount || 0;
      const ads = response.data.results || [];
      
      console.log(`[SCRAPECREATORS] ✅ Found ${totalActiveAds} active ads for pageId: ${pageId}`);

      // Track credits usage
      if (userId) {
        try {
          const { creditsTrackingService } = await import('./creditsTrackingService.js');
          await creditsTrackingService.trackCreditsUsage(userId, 1);
        } catch (error) {
          console.error('❌ Error tracking credits for advertiser stats:', error);
        }
      }
      
      return {
        totalActiveAds: totalActiveAds,
        ads: ads
      };

    } catch (error: any) {
      console.error(`[SCRAPECREATORS] ❌ Error getting advertiser stats for ${pageId}:`, error.message);
      
      if (error.response) {
        console.error('[SCRAPECREATORS] Response error:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      
      // Return default values on error
      return {
        totalActiveAds: 0,
        ads: []
      };
    }
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }
}

export const scrapeCreatorsService = new ScrapeCreatorsService();

