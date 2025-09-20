import express from 'express';
import { FacebookService } from '@/services/facebookService.js';
import { collections } from '@/services/database.js';
import { asyncHandler, CustomError } from '@/middleware/errorHandler.js';
import type { SearchParams, SearchResponse } from '@shared/types/index.js';
import { FacebookScraperService } from '../services/facebookScraperService.js';
import { AdvertiserStatsService } from '../services/advertiserStatsService.js';
import { searchRateLimit, scrapingRateLimit } from '@/middleware/rateLimiter.js';
import { authenticateToken } from '@/middleware/authMiddleware.js';
import { cacheService } from '@/services/cacheService.js';
import { advertiserStatsQueue } from '@/services/simpleQueue.js';

const router = express.Router();

// Lazy initialization to ensure environment variables are loaded
let facebookService: FacebookService | null = null;
function getFacebookService(): FacebookService {
  if (!facebookService) {
    facebookService = new FacebookService();
  }
  return facebookService;
}

// POST /api/search - Main search endpoint
router.post('/', authenticateToken, searchRateLimit, asyncHandler(async (req, res) => {
  const searchParams: SearchParams = req.body;
  
  // Validate required fields
  if (!searchParams.value) {
    throw new CustomError('El valor de búsqueda es requerido', 400);
  }

  console.log(`[SEARCH] 🔍 Starting search: "${searchParams.value}" (${searchParams.searchType})`);
  
  try {
    // Check cache first (only for non-Apify searches to avoid cost issues)
    let searchResult: SearchResponse;
    
    if (!searchParams.useApify) {
      const cacheKey = cacheService.generateSearchKey(searchParams);
      const cachedResult = cacheService.getSearchResult(cacheKey);
      
      if (cachedResult) {
        console.log(`[CACHE] ✅ Using cached search result for: "${searchParams.value}"`);
        searchResult = cachedResult;
      } else {
        // Execute search using FacebookService
        searchResult = await getFacebookService().searchAds(searchParams);
        
        // Cache the result for 1 hour
        cacheService.setSearchResult(cacheKey, searchResult, 60 * 60);
        console.log(`[CACHE] 💾 Cached search result for: "${searchParams.value}"`);
      }
    } else {
      // Don't cache Apify results due to cost implications
      searchResult = await getFacebookService().searchAds(searchParams);
    }
    
    // Auto-save complete search for Apify results
    if (searchParams.useApify && searchResult.data.length > 0) {
      try {
        const searchName = `Apify-${searchParams.value}-${searchParams.country || 'CO'}-${new Date().toISOString().split('T')[0]}`;
        
        const existingSearch = await collections.completeSearches.findOne({ searchName });
        
        if (!existingSearch) {
          const completeSearchData = {
            searchName,
            searchParams,
            executedAt: new Date().toISOString(),
            source: 'apify_scraping',
            totalResults: searchResult.data.length,
            results: searchResult.data,
            metadata: {
              country: searchParams.country || 'CO',
              searchTerm: searchParams.value,
              minDays: searchParams.minDays || 0,
              adType: searchParams.adType || 'ALL',
              useApify: true,
              apifyCount: searchParams.apifyCount
            },
            stats: {
              avgHotnessScore: searchResult.data.reduce((sum, ad) => sum + (ad.hotness_score || 0), 0) / searchResult.data.length,
              longRunningAds: searchResult.data.filter(ad => ad.is_long_running).length,
              topPages: [...new Set(searchResult.data.map(ad => ad.page_name))].slice(0, 10)
            },
            lastAccessed: new Date().toISOString(),
            accessCount: 1
          };
          
          await collections.completeSearches.insertOne(completeSearchData as any);
          
          searchResult.autoSaved = {
            saved: true,
            searchName,
            message: '💰 Búsqueda Apify guardada automáticamente - Reutilizable sin costo adicional'
          };
          
          console.log(`[AUTO_SAVE] ✅ Apify search auto-saved: "${searchName}" with ${searchResult.data.length} ads`);
        } else {
          searchResult.autoSaved = {
            saved: false,
            message: `Búsqueda ya existe: "${searchName}"`
          };
        }
      } catch (saveError) {
        console.error(`[AUTO_SAVE] ❌ Error auto-saving search:`, saveError);
        searchResult.autoSaved = {
          saved: false,
          message: 'Error al auto-guardar búsqueda'
        };
      }
    }

    // Check which ads are already saved
    if (searchResult.data.length > 0) {
      try {
        const adIds = searchResult.data.map(ad => ad.id);
        const savedAds = await collections.savedAds.find(
          { 'adData.id': { $in: adIds } }
        ).toArray();
        
        const savedAdIds = new Set(savedAds.map(savedAd => savedAd.adData.id));
        
        // Mark ads that are already saved
        searchResult.data.forEach(ad => {
          ad.isSaved = savedAdIds.has(ad.id);
          if (ad.isSaved) {
            const savedAdData = savedAds.find(savedAd => savedAd.adData.id === ad.id);
            if (savedAdData) {
              ad.savedInfo = {
                savedAt: savedAdData.savedAt,
                collection: savedAdData.collection,
                tags: savedAdData.tags,
                isFavorite: savedAdData.isFavorite
              };
            }
          }
        });
        
        const savedCount = searchResult.data.filter(ad => ad.isSaved).length;
        if (savedCount > 0) {
          console.log(`[SAVED_ADS] 📌 ${savedCount} of ${searchResult.data.length} ads already saved`);
        }
        
      } catch (error) {
        console.error(`[SAVED_ADS] ❌ Error checking saved ads:`, error);
        // Don't fail the search if checking saved ads fails
      }
    }

    // Sort by hotness score
    searchResult.data.sort((a, b) => {
      // First by hotness score (descending)
      if (b.hotness_score !== a.hotness_score) {
        return b.hotness_score - a.hotness_score;
      }
      // Then by collation count
      if (b.collation_count !== a.collation_count) {
        return (b.collation_count || 0) - (a.collation_count || 0);
      }
      // Finally by days running
      return (b.days_running || 0) - (a.days_running || 0);
    });

    console.log(`[SEARCH] ✅ Search completed: ${searchResult.data.length} ads found`);
    
    res.json(searchResult);
    
  } catch (error) {
    console.error(`[SEARCH] ❌ Search failed:`, error);
      throw new CustomError(
      error instanceof Error ? error.message : 'Error en la búsqueda', 
      500
    );
  }
}));

// GET /api/search/multiple-pages - Fetch multiple pages
router.get('/multiple-pages', asyncHandler(async (req, res) => {
  const { initialUrl, maxPages = 5 } = req.query;
  
  if (!initialUrl || typeof initialUrl !== 'string') {
    throw new CustomError('La URL inicial es requerida', 400);
  }
  
  const pages = parseInt(maxPages as string) || 5;
  
  console.log(`[SEARCH] 📄 Fetching multiple pages: ${pages} pages max`);
  
  try {
    const result = await getFacebookService().fetchMultiplePages(initialUrl, pages);
    
    console.log(`[SEARCH] ✅ Multiple pages completed: ${result.data.length} total ads`);
    
    res.json(result);
    
  } catch (error) {
    console.error(`[SEARCH] ❌ Multiple pages failed:`, error);
    throw new CustomError(
      error instanceof Error ? error.message : 'Error al obtener múltiples páginas', 
      500
    );
  }
}));

// POST /api/ads/scrape-advertiser - Scrape all ads from a specific advertiser
router.post('/scrape-advertiser', scrapingRateLimit, asyncHandler(async (req, res) => {
  const { advertiserName, maxAds = 50, country = 'CO', useStealth = true } = req.body;

  if (!advertiserName || typeof advertiserName !== 'string') {
    throw new CustomError('Advertiser name is required and must be a string', 400);
  }

  console.log(`[SCRAPER] 🚀 Starting scraping for advertiser: ${advertiserName}`);
  
  const scraper = new FacebookScraperService();
  
  try {
    const result = await scraper.scrapeAdvertiserAds({
      advertiserName,
      maxAds: Math.min(maxAds, 100), // Limit to 100 ads max
      country,
      useStealth
    });

    console.log(`[SCRAPER] ✅ Scraping completed: ${result.totalFound} ads found`);
    
    res.json({
      success: result.success,
      data: result.data,
      totalFound: result.totalFound,
      executionTime: result.executionTime,
      advertiserName,
      message: result.success 
        ? `Successfully scraped ${result.totalFound} ads from ${advertiserName}`
        : `Failed to scrape ads: ${result.error}`,
      debug: result.debug
    });

  } catch (error) {
    console.error(`[SCRAPER] ❌ Scraping failed:`, error);
    throw new CustomError(
      error instanceof Error ? error.message : 'Error al hacer scraping de anuncios',
      500
    );
  } finally {
    await scraper.close();
  }
}));

// POST /api/ads/advertiser-stats - Get total active ads count for a page by pageId
router.post('/advertiser-stats', authenticateToken, scrapingRateLimit, asyncHandler(async (req, res) => {
  const { pageId, country = 'ALL' } = req.body;

  if (!pageId || typeof pageId !== 'string') {
    throw new CustomError('pageId is required and must be a string', 400);
  }

  const userId = (req as any).user?._id?.toString() || 'anonymous';
  console.log(`[STATS] 📊 Getting stats for pageId: ${pageId} (user: ${userId})`);
  
  // Check cache first
  const cachedStats = cacheService.getAdvertiserStats(pageId);
  if (cachedStats) {
    console.log(`[STATS] ✅ Using cached stats for pageId: ${pageId}`);
    return res.json({
      ...cachedStats,
      cached: true
    });
  }
  
  try {
    // Use queue instead of direct execution for better concurrency control
    const result = await advertiserStatsQueue.add('advertiser-stats', { pageId, country }, 5, 2, userId);

    console.log(`[STATS] ✅ Stats retrieval completed: ${result.stats?.totalActiveAds || 0} total ads`);
    
    const responseData = {
      success: result.success,
      pageId,
      advertiserName: result.stats?.advertiserName,
      totalActiveAds: result.stats?.totalActiveAds || 0,
      lastUpdated: result.stats?.lastUpdated,
      executionTime: result.executionTime,
      message: result.success 
        ? `Found ${result.stats?.totalActiveAds || 0} total active ads for ${result.stats?.advertiserName || pageId}`
        : `Failed to get stats: ${result.error}`,
      debug: result.debug
    };

    // Cache successful results for 30 minutes
    if (result.success) {
      cacheService.setAdvertiserStats(pageId, responseData, 30 * 60);
      console.log(`[STATS] 💾 Cached stats for pageId: ${pageId}`);
    }
    
    res.json(responseData);

  } catch (error) {
    console.error(`[STATS] ❌ Stats retrieval failed:`, error);
    throw new CustomError(
      error instanceof Error ? error.message : 'Error al obtener estadísticas del anunciante',
      500
    );
  }
}));

// Cancel pending jobs for current user
router.post('/cancel-pending', authenticateToken, asyncHandler(async (req, res) => {
  const userId = (req as any).user?._id?.toString() || 'anonymous';
  
  console.log(`[CANCEL] 🚫 Cancelling pending jobs for user: ${userId}`);
  
  // Respond immediately and process cancellation in background
  res.json({
    success: true,
    message: 'Cancellation request received',
    cancelledCount: 0, // Will be updated in background
    remainingJobs: 0,
    userId: userId === 'anonymous' ? 'anonymous' : 'authenticated',
    immediate: true
  });
  
  // Process cancellation in background without blocking response
  setImmediate(() => {
    try {
      const cancelledCount = advertiserStatsQueue.cancelUserJobs(userId);
      const remainingJobs = advertiserStatsQueue.getUserPendingJobs(userId);
      console.log(`[CANCEL] ✅ Background cancellation completed: ${cancelledCount} jobs cancelled, ${remainingJobs} remaining`);
    } catch (error) {
      console.error(`[CANCEL] ❌ Background cancellation failed:`, error);
    }
  });
}));

// Test endpoint to verify debug functionality
router.post('/test-debug', asyncHandler(async (req, res) => {
  const { pageId = '1835332883255867', country = 'ALL' } = req.body;

  console.log(`🧪 Testing debug functionality for pageId: ${pageId}`);
  
  const statsService = new AdvertiserStatsService();
  
  try {
    const result = await statsService.getAdvertiserStats(pageId, country);
    
    res.json({
      success: true,
      message: 'Debug test completed',
      result: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in test-debug endpoint:', error);
    throw new CustomError(
      error instanceof Error ? error.message : 'Error en test de debug',
      500
    );
  } finally {
    await statsService.close();
  }
}));

// Test endpoint with direct URL
router.post('/test-direct-url', asyncHandler(async (req, res) => {
  const { url } = req.body;

  if (!url) {
    throw new CustomError('URL is required', 400);
  }

  console.log(`🧪 Testing direct URL: ${url}`);
  
  const { chromium } = await import('playwright');
  
  try {
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Navigate to the URL
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Wait for content to load
    await page.waitForTimeout(5000);

    // Extract the count using our improved logic
    const countResult = await page.evaluate(() => {
      const text = document.body.innerText;
      
      // Look for the specific Facebook pattern "~X.XXX resultados"
      const tildePattern = text.match(/~(\d{1,3}(?:\.\d{3})*)\s*resultados?/i);
      if (tildePattern) {
        return {
          found: true,
          pattern: 'tilde',
          count: parseInt(tildePattern[1].replace(/\./g, '')),
          text: tildePattern[0]
        };
      }
      
      // Look for "X.XXX resultados" pattern (without tilde)
      const resultadosPattern = text.match(/(\d{1,3}(?:\.\d{3})*)\s*resultados?/i);
      if (resultadosPattern) {
        return {
          found: true,
          pattern: 'resultados',
          count: parseInt(resultadosPattern[1].replace(/\./g, '')),
          text: resultadosPattern[0]
        };
      }
      
      return { found: false, text: text.substring(0, 1000) };
    });

    const pageTitle = await page.title();
    const pageContentLength = (await page.content()).length;
    
    res.json({
      success: true,
      message: 'Direct URL test completed',
      url: url,
      pageTitle: pageTitle,
      pageContentLength: pageContentLength,
      countResult: countResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in test-direct-url endpoint:', error);
    throw new CustomError(
      error instanceof Error ? error.message : 'Error en test de URL directa',
      500
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}));

// Test endpoint using EXACT same config as working test-direct-url
router.post('/test-pageId-direct', asyncHandler(async (req, res) => {
  const { pageId = '1835332883255867' } = req.body;

  console.log(`🧪 Testing pageId with EXACT same config as working endpoint: ${pageId}`);
  
  const { chromium } = await import('playwright');
  
  try {
    // Use EXACT same config as test-direct-url (which works)
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Build URL same way as AdvertiserStatsService
    const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=${pageId}`;
    
    console.log(`📱 Navigating to: ${url}`);
    
    // Use EXACT same navigation as test-direct-url
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Use EXACT same wait time as test-direct-url
    await page.waitForTimeout(5000);

    // Use EXACT same extraction logic as test-direct-url
    const countResult = await page.evaluate(() => {
      const text = document.body.innerText;
      
      // Look for the specific Facebook pattern "~X.XXX resultados"
      const tildePattern = text.match(/~(\d{1,3}(?:\.\d{3})*)\s*resultados?/i);
      if (tildePattern) {
        return {
          found: true,
          pattern: 'tilde',
          count: parseInt(tildePattern[1].replace(/\./g, '')),
          text: tildePattern[0]
        };
      }
      
      // Look for "X.XXX resultados" pattern (without tilde)
      const resultadosPattern = text.match(/(\d{1,3}(?:\.\d{3})*)\s*resultados?/i);
      if (resultadosPattern) {
        return {
          found: true,
          pattern: 'resultados',
          count: parseInt(resultadosPattern[1].replace(/\./g, '')),
          text: resultadosPattern[0]
        };
      }
      
      return { 
        found: false, 
        text: text.substring(0, 1000),
        textLength: text.length
      };
    });

    const pageTitle = await page.title();
    const pageContentLength = (await page.content()).length;
    
    res.json({
      success: true,
      message: 'PageId test with exact working config completed',
      pageId: pageId,
      url: url,
      pageTitle: pageTitle,
      pageContentLength: pageContentLength,
      countResult: countResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in test-pageId-direct endpoint:', error);
    throw new CustomError(
      error instanceof Error ? error.message : 'Error en test de pageId directo',
      500
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}));


export default router;
