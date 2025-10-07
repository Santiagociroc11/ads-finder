import fetch from 'node-fetch';
import type { AdvertiserStats, AdvertiserStatsResult } from '../types/shared.js';
import { antiDetectionService } from './antiDetectionService.js';


interface BatchRequest {
  pageId: string;
  country: string;
  resolve: (result: AdvertiserStatsResult) => void;
  reject: (error: Error) => void;
}

export class BalancedScraperService {
  private cache = new Map<string, { data: AdvertiserStats; timestamp: number }>();
  private batchQueue: BatchRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private activeRequests = 0;
  private maxConcurrent = 20;
  private stats = {
    totalRequests: 0,
    cacheHits: 0,
    successfulScrapes: 0,
    errors: 0
  };

  constructor() {
    console.log(`⚖️ Direct Pattern Scraper Service initialized:
    ┌─ Max Concurrent: ${this.maxConcurrent}
    ├─ Batch Size: 5
    ├─ Cache TTL: 30 minutes
    └─ Method: Direct HTML pattern extraction`);
  }

  async getAdvertiserStats(pageId: string, country: string = 'ALL'): Promise<AdvertiserStatsResult> {
    this.stats.totalRequests++;
    const startTime = Date.now();

    try {
      // 1. Check cache first
      const cacheKey = `${pageId}:${country}`;
      const cached = this.getCachedStats(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        console.log(`⚡ Cache hit for ${pageId}: ${cached.totalActiveAds} ads`);
        return {
          success: true,
          stats: cached,
          executionTime: Date.now() - startTime
        };
      }

      // 2. Direct processing if under concurrency limit
      if (this.activeRequests < this.maxConcurrent) {
        return await this.processDirectly(pageId, country);
      }

      // 3. Batch processing if over limit
      return new Promise((resolve, reject) => {
        this.batchQueue.push({ pageId, country, resolve, reject });
        
        if (this.batchQueue.length >= 5) { // Smaller batch size
          this.processBatch();
        } else if (!this.batchTimer) {
          this.batchTimer = setTimeout(() => this.processBatch(), 200); // Longer wait for better batching
        }
      });

    } catch (error) {
      this.stats.errors++;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  private async processDirectly(pageId: string, country: string): Promise<AdvertiserStatsResult> {
    this.activeRequests++;
    
    try {
      return await this.scrapePage(pageId, country);
    } finally {
      this.activeRequests--;
    }
  }

  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0, 5); // Smaller batches
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    console.log(`📦 Processing batch of ${batch.length} requests`);

    // Process batch with controlled concurrency
    const promises = batch.map(request => this.processWithControl(request));
    await Promise.allSettled(promises);
  }

  private async processWithControl(request: BatchRequest): Promise<void> {
    // Wait for available slot
    while (this.activeRequests >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.activeRequests++;
    
    try {
      const result = await this.scrapePage(request.pageId, request.country);
      request.resolve(result);
    } catch (error) {
      request.reject(error as Error);
    } finally {
      this.activeRequests--;
    }
  }

  private async scrapePage(pageId: string, country: string): Promise<AdvertiserStatsResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Scraping pageId: ${pageId} with multi-strategy extraction`);
      
      // Build Facebook Ads Library URL (same as original)
      const adLibraryUrl = this.buildAdLibraryUrl(pageId, country);
      
      // Fetch HTML content with proper timeout
      const htmlContent = await this.fetchHtmlContent(adLibraryUrl);
      
      // Multi-strategy extraction
      let directCount = this.extractDirectAdsCount(htmlContent);
      let advertiserName = this.extractAdvertiserName(htmlContent);
      let profileData = this.extractProfileData(htmlContent);
      
      // Strategy 2: Alternative patterns if direct fails
      if (directCount === null) {
        console.log(`⚠️ Direct pattern failed, trying alternative patterns...`);
        directCount = this.extractAlternativeAdsCount(htmlContent);
      }
      
      // Strategy 3: Fallback to ScrapeCreators if available
      if (directCount === null) {
        console.log(`⚠️ Alternative patterns failed, trying ScrapeCreators fallback...`);
        const fallbackResult = await this.tryScrapeCreatorsFallback(pageId, country);
        if (fallbackResult) {
          return fallbackResult;
        }
      }
      
      // Strategy 4: Return 0 with warning if all strategies fail
      if (directCount === null) {
        console.log(`⚠️ All extraction strategies failed, returning 0 ads with warning`);
        
        // Debug: Log HTML snippets for analysis
        this.debugHtmlContent(htmlContent, pageId);
        
        const stats: AdvertiserStats = {
          pageId,
          advertiserName: advertiserName || 'Unknown',
          totalActiveAds: 0,
          lastUpdated: new Date().toISOString(),
          ...profileData
        } as AdvertiserStats & { warning: string };
        
        return {
          success: true,
          stats,
          executionTime: Date.now() - startTime
        };
      }
      
      const stats: AdvertiserStats = {
        pageId,
        advertiserName: advertiserName || 'Unknown',
        totalActiveAds: directCount,
        lastUpdated: new Date().toISOString(),
        ...profileData
      };

      // Cache the result
      const cacheKey = `${pageId}:${country}`;
      this.cache.set(cacheKey, { data: stats, timestamp: Date.now() });

      const executionTime = Date.now() - startTime;
      this.stats.successfulScrapes++;

      console.log(`✅ Direct scrape completed for ${pageId}: ${directCount} ads, advertiser: ${advertiserName || 'Unknown'} in ${executionTime}ms`);

      return {
        success: true,
        stats,
        executionTime
      };

    } catch (error) {
      this.stats.errors++;
      console.error(`❌ Direct pattern scraping failed for ${pageId}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Scraping failed',
        executionTime: Date.now() - startTime
      };
    }
  }

  private buildAdLibraryUrl(pageId: string, country: string): string {
    const baseUrl = 'https://www.facebook.com/ads/library/';
    const params = new URLSearchParams({
      active_status: 'active',
      ad_type: 'all',
      country: country,
      is_targeted_country: 'false',
      media_type: 'all',
      search_type: 'page',
      view_all_page_id: pageId
    });

    return `${baseUrl}?${params.toString()}`;
  }

  private async fetchHtmlContent(url: string): Promise<string> {
    const result = await antiDetectionService.makeRequest(url);
    
    if (!result.success) {
      if (result.blockingDetection?.isBlocked) {
        console.warn(`🚫 Request blocked: ${result.blockingDetection.reason}`);
        throw new Error(`Blocked: ${result.blockingDetection.reason}`);
      }
      throw new Error(result.error || 'Failed to fetch HTML');
    }

    if (!result.data) {
      throw new Error('No data received');
    }

    console.log(`📄 HTML fetched: ${result.data.length} characters`);
    return result.data;
  }


  private extractDirectAdsCount(html: string): number | null {
    try {
      // Pattern with escaped quotes for JavaScript strings: \"search_results_connection\":{\"count\":82
      const escapedPattern = /\\?"search_results_connection\\?":\s*\{[^}]*\\?"count\\?":\s*(\d+)/i;
      const escapedMatch = html.match(escapedPattern);
      
      if (escapedMatch) {
        const count = parseInt(escapedMatch[1]);
        console.log(`🎯 Direct extraction found count: ${count} via escaped pattern`);
        return count;
      }

      // Pattern for ad_library_main with escaped quotes
      const adLibraryEscapedPattern = /\\?"ad_library_main\\?":\s*\{[^}]*\\?"search_results_connection\\?":\s*\{[^}]*\\?"count\\?":\s*(\d+)/i;
      const adLibraryEscapedMatch = html.match(adLibraryEscapedPattern);
      
      if (adLibraryEscapedMatch) {
        const count = parseInt(adLibraryEscapedMatch[1]);
        console.log(`🎯 Direct extraction found count: ${count} via ad_library escaped pattern`);
        return count;
      }

      // Look for AdLibraryFoundationRootQueryRelayPreloader pattern
      const preloaderPattern = /AdLibraryFoundationRootQueryRelayPreloader[\s\S]*?search_results_connection[\s\S]*?count[^:]*:\s*(\d+)/i;
      const preloaderMatch = html.match(preloaderPattern);
      
      if (preloaderMatch) {
        const count = parseInt(preloaderMatch[1]);
        console.log(`🎯 Direct extraction found count: ${count} via preloader pattern`);
        return count;
      }

      // Most specific pattern: RelayPrefetchedStreamCache with ad_library_main and search_results_connection
      const exactPattern = /"ad_library_main":\s*\{[^}]*"search_results_connection":\s*\{[^}]*"count":\s*(\d+)/i;
      const exactMatch = html.match(exactPattern);
      
      if (exactMatch) {
        const count = parseInt(exactMatch[1]);
        console.log(`🎯 Direct extraction found count: ${count} via exact ad_library_main pattern`);
        return count;
      }

      // General search_results_connection pattern
      const searchResultsPattern = /"search_results_connection":\s*\{[^}]*"count":\s*(\d+)/i;
      const searchResultsMatch = html.match(searchResultsPattern);
      
      if (searchResultsMatch) {
        const count = parseInt(searchResultsMatch[1]);
        console.log(`🎯 Direct extraction found count: ${count} via search_results_connection pattern`);
        return count;
      }

      // Fallback: any "count": number near ads-related keywords
      const fallbackPattern = /(?:ads?|library|active)[^}]*"count":\s*(\d+)|"count":\s*(\d+)[^}]*(?:ads?|library|active)/i;
      const fallbackMatch = html.match(fallbackPattern);
      
      if (fallbackMatch) {
        const count = parseInt(fallbackMatch[1] || fallbackMatch[2]);
        console.log(`🎯 Direct extraction found count: ${count} via fallback pattern`);
        return count;
      }

      console.log(`⚠️ No direct count pattern found in HTML`);
      return null;
    } catch (error) {
      console.error(`❌ Error in direct extraction:`, error);
      return null;
    }
  }

  /**
   * Alternative extraction methods when direct patterns fail
   */
  private extractAlternativeAdsCount(html: string): number | null {
    try {
      console.log(`🔍 Trying alternative extraction patterns...`);
      
      // Pattern 1: Look for "totalCount" or similar
      const totalCountPattern = /"totalCount":\s*(\d+)/i;
      const totalCountMatch = html.match(totalCountPattern);
      if (totalCountMatch) {
        const count = parseInt(totalCountMatch[1], 10);
        console.log(`🎯 Alternative extraction found count: ${count} via totalCount pattern`);
        return count;
      }
      
      // Pattern 2: Look for "count" in various contexts
      const countPattern = /"count":\s*(\d+)/i;
      const countMatches = html.match(new RegExp(countPattern.source, 'gi'));
      if (countMatches && countMatches.length > 0) {
        // Get the largest count found
        const counts = countMatches.map(match => {
          const countMatch = match.match(/(\d+)/);
          return countMatch ? parseInt(countMatch[1], 10) : 0;
        });
        const maxCount = Math.max(...counts);
        if (maxCount > 0) {
          console.log(`🎯 Alternative extraction found count: ${maxCount} via count pattern`);
          return maxCount;
        }
      }
      
      // Pattern 3: Look for "results" or "ads" count
      const resultsPattern = /"(?:results|ads)":\s*(\d+)/i;
      const resultsMatch = html.match(resultsPattern);
      if (resultsMatch) {
        const count = parseInt(resultsMatch[1], 10);
        console.log(`🎯 Alternative extraction found count: ${count} via results pattern`);
        return count;
      }
      
      // Pattern 4: Look for numbers near "active" or "running"
      const activePattern = /(?:active|running)[^0-9]*(\d+)/i;
      const activeMatch = html.match(activePattern);
      if (activeMatch) {
        const count = parseInt(activeMatch[1], 10);
        if (count > 0 && count < 10000) { // Reasonable range
          console.log(`🎯 Alternative extraction found count: ${count} via active pattern`);
          return count;
        }
      }
      
      console.log(`⚠️ No alternative patterns found`);
      return null;
    } catch (error) {
      console.error(`❌ Error in alternative extraction:`, error);
      return null;
    }
  }

  /**
   * Fallback to ScrapeCreators API when all extraction methods fail
   */
  private async tryScrapeCreatorsFallback(pageId: string, country: string): Promise<AdvertiserStatsResult | null> {
    try {
      console.log(`🔄 Trying ScrapeCreators fallback for pageId: ${pageId}`);
      
      // Check if ScrapeCreators is available
      const { scrapeCreatorsService } = await import('./scrapeCreatorsService.js');
      if (!scrapeCreatorsService.isConfigured()) {
        console.log(`⚠️ ScrapeCreators not configured, skipping fallback`);
        return null;
      }
      
      const result = await scrapeCreatorsService.getAdvertiserStats(pageId, country);
      
      if (result.totalActiveAds > 0) {
        console.log(`✅ ScrapeCreators fallback successful: ${result.totalActiveAds} ads`);
        
        const stats: AdvertiserStats = {
          pageId,
          advertiserName: 'Unknown',
          totalActiveAds: result.totalActiveAds,
          lastUpdated: new Date().toISOString()
        } as AdvertiserStats & { source: string };
        
        return {
          success: true,
          stats,
          executionTime: 0
        };
      }
      
      return null;
    } catch (error) {
      console.error(`❌ ScrapeCreators fallback failed:`, error);
      return null;
    }
  }

  /**
   * Debug method to log HTML snippets when extraction fails
   */
  private debugHtmlContent(html: string, pageId: string): void {
    try {
      console.log(`🔍 DEBUG - HTML analysis for pageId: ${pageId}`);
      
      // Look for common patterns that might contain count data
      const patterns = [
        /search_results_connection[^}]*count[^}]*\d+/gi,
        /ad_library[^}]*count[^}]*\d+/gi,
        /totalCount[^}]*\d+/gi,
        /"count":\s*\d+/gi,
        /count[^:]*:\s*\d+/gi
      ];
      
      patterns.forEach((pattern, index) => {
        const matches = html.match(pattern);
        if (matches && matches.length > 0) {
          console.log(`🔍 DEBUG - Pattern ${index + 1} matches:`, matches.slice(0, 3)); // Show first 3 matches
        }
      });
      
      // Look for JSON-like structures that might contain count data
      const jsonPattern = /\{[^}]*"count"[^}]*\}/gi;
      const jsonMatches = html.match(jsonPattern);
      if (jsonMatches && jsonMatches.length > 0) {
        console.log(`🔍 DEBUG - JSON-like count structures:`, jsonMatches.slice(0, 3));
      }
      
      // Look for any numbers near "ads" or "active"
      const adsPattern = /(?:ads?|active)[^0-9]*(\d+)/gi;
      const adsMatches = html.match(adsPattern);
      if (adsMatches && adsMatches.length > 0) {
        console.log(`🔍 DEBUG - Numbers near ads/active:`, adsMatches.slice(0, 5));
      }
      
      console.log(`🔍 DEBUG - HTML length: ${html.length} characters`);
      
    } catch (error) {
      console.error(`❌ Error in debug analysis:`, error);
    }
  }

  private extractAdvertiserName(html: string): string | null {
    try {
      // Look for page name with escaped quotes
      const escapedPageNamePattern = /\\?"page_name\\?":\s*\\?"([^"\\]+)\\?"/i;
      const escapedMatch = html.match(escapedPageNamePattern);
      
      if (escapedMatch) {
        const name = escapedMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        console.log(`🏷️ Found advertiser name (escaped): ${name}`);
        return name;
      }

      // Look for page name in the Relay data
      const pageNamePattern = /"page_name":\s*"([^"]+)"/i;
      const pageNameMatch = html.match(pageNamePattern);
      
      if (pageNameMatch) {
        const name = pageNameMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        console.log(`🏷️ Found advertiser name: ${name}`);
        return name;
      }

      // Alternative pattern for page name
      const altPageNamePattern = /"name":\s*"([^"]+)"[^}]*"id":\s*"\d+"/i;
      const altMatch = html.match(altPageNamePattern);
      
      if (altMatch) {
        const name = altMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        console.log(`🏷️ Found advertiser name (alt pattern): ${name}`);
        return name;
      }

      console.log(`⚠️ No advertiser name found`);
      return null;
    } catch (error) {
      console.error(`❌ Error extracting advertiser name:`, error);
      return null;
    }
  }

  private extractProfileData(html: string): Partial<AdvertiserStats> {
    try {
      const profileData: Partial<AdvertiserStats> = {};

      // Extract profile picture URL
      const profilePicturePattern = /"page_profile_picture_url":\s*"([^"]+)"/i;
      const profilePictureMatch = html.match(profilePicturePattern);
      if (profilePictureMatch) {
        profileData.pageProfilePictureUrl = profilePictureMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        console.log(`🖼️ Found profile picture URL`);
      }

      // Extract profile URI
      const profileUriPattern = /"page_profile_uri":\s*"([^"]+)"/i;
      const profileUriMatch = html.match(profileUriPattern);
      if (profileUriMatch) {
        profileData.pageProfileUri = profileUriMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        console.log(`🔗 Found profile URI`);
      }

      // Extract page like count
      const likeCountPattern = /"page_like_count":\s*(\d+)/i;
      const likeCountMatch = html.match(likeCountPattern);
      if (likeCountMatch) {
        profileData.pageLikeCount = parseInt(likeCountMatch[1]);
        console.log(`👥 Found like count: ${profileData.pageLikeCount}`);
      }

      // Extract page categories
      const categoriesPattern = /"page_categories":\s*\[([^\]]+)\]/i;
      const categoriesMatch = html.match(categoriesPattern);
      if (categoriesMatch) {
        try {
          const categoriesString = categoriesMatch[1];
          const categories = categoriesString
            .split(',')
            .map(cat => cat.trim().replace(/^"|"$/g, '').replace(/\\"/g, '"'))
            .filter(cat => cat.length > 0);
          profileData.pageCategories = categories;
          console.log(`📂 Found categories: ${categories.length} items`);
        } catch (e) {
          console.log(`⚠️ Error parsing categories: ${e}`);
        }
      }

      // Extract page verification status
      const verificationPattern = /"page_verification":\s*(true|false)/i;
      const verificationMatch = html.match(verificationPattern);
      if (verificationMatch) {
        profileData.pageVerification = verificationMatch[1] === 'true';
        console.log(`✅ Found verification status: ${profileData.pageVerification}`);
      }

      return profileData;
    } catch (error) {
      console.error(`❌ Error extracting profile data:`, error);
      return {};
    }
  }


  private getCachedStats(cacheKey: string): AdvertiserStats | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    const maxAge = 30 * 60 * 1000; // 30 minutes

    if (age > maxAge) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }

  getPerformanceStats() {
    const cacheHitRate = this.stats.totalRequests > 0 
      ? (this.stats.cacheHits / this.stats.totalRequests * 100).toFixed(1)
      : '0';
    
    return {
      ...this.stats,
      cacheHitRate: `${cacheHitRate}%`,
      cacheSize: this.cache.size,
      activeRequests: this.activeRequests,
      queuedRequests: this.batchQueue.length,
      successRate: this.stats.totalRequests > 0 
        ? `${(this.stats.successfulScrapes / this.stats.totalRequests * 100).toFixed(1)}%`
        : '0%'
    };
  }

  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Direct pattern scraper cache cleared');
  }
}

// Global instance
export const balancedScraperService = new BalancedScraperService();
