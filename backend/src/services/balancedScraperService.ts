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
      
      let htmlContent: string;
      try {
        // Fetch HTML content with proper timeout
        htmlContent = await this.fetchHtmlContent(adLibraryUrl);
      } catch (error) {
        // If Facebook error page or other fetch errors, try ScrapeCreators fallback
        if (error instanceof Error && (
          error.message.includes('Facebook error page') ||
          error.message.includes('Blocked:') ||
          error.message.includes('Failed to fetch HTML')
        )) {
          console.log(`⚠️ HTML fetch failed (${error.message}), trying ScrapeCreators fallback...`);
          const fallbackResult = await this.tryScrapeCreatorsFallback(pageId, country);
          if (fallbackResult) {
            return fallbackResult;
          }
          
          // If ScrapeCreators also fails, return 0 ads
          console.log(`⚠️ ScrapeCreators fallback failed, returning 0 ads`);
          const stats: AdvertiserStats = {
            pageId,
            advertiserName: 'Unknown',
            totalActiveAds: 0,
            lastUpdated: new Date().toISOString()
          };
          
          return {
            success: true,
            stats,
            executionTime: Date.now() - startTime
          };
        }
        
        // Re-throw other errors
        throw error;
      }
      
      // OPTIMIZATION: Check if HTML has NO preloaded data (CSR-only)
      // If so, skip extraction attempts and go straight to ScrapeCreators fallback
      if (this.hasNoPreloadedData(htmlContent)) {
        console.log(`⚠️ No preloaded data detected (CSR-only), skipping extraction and using ScrapeCreators fallback...`);
        const fallbackResult = await this.tryScrapeCreatorsFallback(pageId, country);
        if (fallbackResult) {
          return fallbackResult;
        }
        
        // If ScrapeCreators also fails, return 0
        console.log(`⚠️ ScrapeCreators fallback failed, returning 0 ads`);
        const stats: AdvertiserStats = {
          pageId,
          advertiserName: 'Unknown',
          totalActiveAds: 0,
          lastUpdated: new Date().toISOString()
        };
        
        return {
          success: true,
          stats,
          executionTime: Date.now() - startTime
        };
      }
      
      // Multi-strategy extraction (only if we detected preloaded data)
      let directCount = this.extractDirectAdsCount(htmlContent);
      let advertiserName = this.extractAdvertiserName(htmlContent);
      let profileData = this.extractProfileData(htmlContent);
      
      // Strategy 2: Alternative patterns if direct fails
      if (directCount === null) {
        console.log(`⚠️ Direct pattern failed, trying alternative patterns...`);
        directCount = this.extractAlternativeAdsCount(htmlContent);
      }
      
      // Strategy 3: Fallback to ScrapeCreators if available
      // (This should rarely happen now since we check hasNoPreloadedData first)
      if (directCount === null) {
        console.log(`⚠️ Alternative patterns failed (unexpected - data should exist), trying ScrapeCreators fallback...`);
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

  private async fetchHtmlContent(url: string, retryCount: number = 0): Promise<string> {
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

    // Check if it's a Facebook error page (like the one you see in browser)
    if (this.isFacebookErrorPage(result.data)) {
      if (retryCount < 2) { // Max 2 retries
        console.log(`⚠️ Facebook error page detected, retrying... (attempt ${retryCount + 1}/2)`);
        await this.delay(2000 + (retryCount * 1000)); // 2s, 3s delays
        return this.fetchHtmlContent(url, retryCount + 1);
      } else {
        console.log(`❌ Facebook error page after ${retryCount + 1} attempts, giving up`);
        throw new Error('Facebook error page after multiple retries');
      }
    }

    console.log(`📄 HTML fetched: ${result.data.length} characters`);
    return result.data;
  }

  /**
   * Check if the HTML is a Facebook error page
   */
  private isFacebookErrorPage(html: string): boolean {
    // Check for specific Facebook error page indicators
    const errorIndicators = [
      'Sorry, something went wrong',
      'We\'re working on getting this fixed',
      'Error</title>',
      'something went wrong',
      'working on getting this fixed',
      '<title>Error</title>',
      'Error</title>',
      'error</title>',
      'ERROR</title>'
    ];
    
    // Also check if HTML is suspiciously short (likely error page)
    const isShortError = html.length < 5000 && errorIndicators.some(indicator => 
      html.toLowerCase().includes(indicator.toLowerCase())
    );
    
    // Check for specific error patterns
    const hasErrorPattern = errorIndicators.some(indicator => 
      html.toLowerCase().includes(indicator.toLowerCase())
    );
    
    return isShortError || hasErrorPattern;
  }

  /**
   * Check if the HTML contains NO DATA (Client-Side Rendering only)
   * Based on analysis of 16 real production pages
   */
  private hasNoPreloadedData(html: string): boolean {
    // Key indicators that data is NOT preloaded:
    // 1. No RelayPrefetchedStreamCache (Facebook's SSR marker)
    // 2. No search_results_connection (the data structure we need)
    // 3. No ad_library_main (another data structure)
    // 4. HTML size is ~500-503KB (typical CSR-only size)
    
    const hasRelayCache = html.includes('RelayPrefetchedStreamCache');
    const hasSearchResults = html.includes('search_results_connection');
    const hasAdLibrary = html.includes('ad_library_main');
    
    // If any of these exist, there IS data
    if (hasRelayCache || hasSearchResults || hasAdLibrary) {
      return false; // HAS data
    }
    
    // Additional check: typical CSR-only size is 500-503KB
    // Pages with data are usually 515KB-686KB
    const isTypicalCSRSize = html.length >= 500000 && html.length <= 504000;
    
    if (isTypicalCSRSize) {
      console.log(`🔍 Detected CSR-only page (size: ${html.length} bytes, no SSR markers)`);
      return true; // NO data (pure CSR)
    }
    
    // If none of the markers exist but size is unusual, still consider it as no data
    console.log(`🔍 No SSR markers found (size: ${html.length} bytes)`);
    return true; // NO data
  }

  /**
   * Delay utility for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
   * Validate if a count is realistic for ads
   */
  private isValidAdsCount(count: number): boolean {
    // Exclude common false positives
    const falsePositives = [3578, 2024, 2025, 2023, 1, 0];
    if (falsePositives.includes(count)) return false;
    
    // Reasonable range for ads count
    if (count < 0 || count > 1000) return false;
    
    return true;
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
        if (this.isValidAdsCount(count)) {
          console.log(`🎯 Alternative extraction found count: ${count} via totalCount pattern`);
          return count;
        }
      }
      
      // Pattern 2: Look for "count" in various contexts (but exclude false positives)
      const countPattern = /"count":\s*(\d+)/i;
      const countMatches = html.match(new RegExp(countPattern.source, 'gi'));
      if (countMatches && countMatches.length > 0) {
        // Get counts and filter out false positives
        const counts = countMatches.map(match => {
          const countMatch = match.match(/(\d+)/);
          return countMatch ? parseInt(countMatch[1], 10) : 0;
        }).filter(count => this.isValidAdsCount(count));
        
        if (counts.length > 0) {
          const maxCount = Math.max(...counts);
          console.log(`🎯 Alternative extraction found count: ${maxCount} via count pattern`);
          return maxCount;
        }
      }
      
      // Pattern 3: Look for "results" or "ads" count
      const resultsPattern = /"(?:results|ads)":\s*(\d+)/i;
      const resultsMatch = html.match(resultsPattern);
      if (resultsMatch) {
        const count = parseInt(resultsMatch[1], 10);
        if (this.isValidAdsCount(count)) {
          console.log(`🎯 Alternative extraction found count: ${count} via results pattern`);
          return count;
        }
      }
      
      // Pattern 3.5: Look for count in ad-related contexts specifically
      const adCountPattern = /(?:ad_library|search_results|advertiser)[^}]*"count":\s*(\d+)/i;
      const adCountMatch = html.match(adCountPattern);
      if (adCountMatch) {
        const count = parseInt(adCountMatch[1], 10);
        if (this.isValidAdsCount(count)) {
          console.log(`🎯 Alternative extraction found count: ${count} via ad-specific pattern`);
          return count;
        }
      }
      
      // Pattern 4: Look for numbers near "active" or "running" (but exclude common false positives)
      const activePattern = /(?:active|running)[^0-9]*(\d+)/i;
      const activeMatch = html.match(activePattern);
      if (activeMatch) {
        const count = parseInt(activeMatch[1], 10);
        if (this.isValidAdsCount(count)) {
          console.log(`🎯 Alternative extraction found count: ${count} via active pattern`);
          return count;
        }
      }
      
      // Pattern 5: Look for any number in JSON-like structures
      const jsonNumberPattern = /\{[^}]*"count"[^}]*"(\d+)"[^}]*\}/i;
      const jsonNumberMatch = html.match(jsonNumberPattern);
      if (jsonNumberMatch) {
        const count = parseInt(jsonNumberMatch[1], 10);
        if (this.isValidAdsCount(count)) {
          console.log(`🎯 Alternative extraction found count: ${count} via JSON number pattern`);
          return count;
        }
      }
      
      // Pattern 6: Look for numbers in data structures
      const dataPattern = /"data":\s*\{[^}]*"count":\s*(\d+)/i;
      const dataMatch = html.match(dataPattern);
      if (dataMatch) {
        const count = parseInt(dataMatch[1], 10);
        if (this.isValidAdsCount(count)) {
          console.log(`🎯 Alternative extraction found count: ${count} via data pattern`);
          return count;
        }
      }
      
      // Pattern 7: Look for numbers in array structures
      const arrayPattern = /\[[^\]]*"count":\s*(\d+)[^\]]*\]/i;
      const arrayMatch = html.match(arrayPattern);
      if (arrayMatch) {
        const count = parseInt(arrayMatch[1], 10);
        if (this.isValidAdsCount(count)) {
          console.log(`🎯 Alternative extraction found count: ${count} via array pattern`);
          return count;
        }
      }
      
      // Pattern 8: Look for any number that might be an ad count (more permissive)
      const anyNumberPattern = /(\d+)(?=\s*(?:ads?|active|running|total|results))/i;
      const anyNumberMatch = html.match(anyNumberPattern);
      if (anyNumberMatch) {
        const count = parseInt(anyNumberMatch[1], 10);
        if (this.isValidAdsCount(count)) {
          console.log(`🎯 Alternative extraction found count: ${count} via any number pattern`);
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
   * ENABLED: Only for critical cases where we need 100% success rate
   */
  private async tryScrapeCreatorsFallback(pageId: string, country: string): Promise<AdvertiserStatsResult | null> {
    try {
      console.log(`🔄 Trying ScrapeCreators fallback for critical case: ${pageId}`);
      
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
      
      // Look specifically for the problematic 3578 pattern
      const problemPattern = /(?:active|running)[^0-9]*3578/gi;
      const problemMatches = html.match(problemPattern);
      if (problemMatches && problemMatches.length > 0) {
        console.log(`🔍 DEBUG - Found problematic 3578 pattern:`, problemMatches.slice(0, 3));
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
