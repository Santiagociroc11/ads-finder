import express from 'express';
import mongoose from 'mongoose';
import { FacebookService } from '@/services/facebookService.js';
import { collections } from '@/services/database.js';
import { asyncHandler, CustomError } from '@/middleware/errorHandler.js';
import type { SearchParams, SearchResponse } from '../types/shared.js';
import { AdvertiserStatsService } from '../services/advertiserStatsService.js';
import { searchRateLimit, scrapingRateLimit } from '@/middleware/rateLimiter.js';
import { authenticateToken } from '@/middleware/authMiddleware.js';
import { cacheService } from '@/services/cacheService.js';
import { advertiserStatsQueue } from '@/services/simpleQueue.js';
import { SearchHistory } from '@/models/SearchHistory.js';

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
  
  const searchStartTime = Date.now();
  
  try {
    // Always use Apify for ads search
    let searchResult: SearchResponse;
    
    // Don't cache Apify results due to cost implications
    searchResult = await getFacebookService().searchAds(searchParams);
    
    // Auto-save complete search for Apify results
    if (searchResult.data.length > 0) {
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
              avgHotnessScore: searchResult.data.reduce((sum: number, ad: any) => sum + (ad.hotness_score || 0), 0) / searchResult.data.length,
              longRunningAds: searchResult.data.filter((ad: any) => ad.is_long_running).length,
              topPages: [...new Set(searchResult.data.map((ad: any) => ad.page_name))].slice(0, 10)
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
        const adIds = searchResult.data.map((ad: any) => ad.id);
        const savedAds = await collections.savedAds.find(
          { 'adData.id': { $in: adIds } }
        ).toArray();
        
        const savedAdIds = new Set(savedAds.map(savedAd => savedAd.adData.id));
        
        // Mark ads that are already saved
        searchResult.data.forEach((ad: any) => {
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
        
        const savedCount = searchResult.data.filter((ad: any) => ad.isSaved).length;
        if (savedCount > 0) {
          console.log(`[SAVED_ADS] 📌 ${savedCount} of ${searchResult.data.length} ads already saved`);
        }
        
      } catch (error) {
        console.error(`[SAVED_ADS] ❌ Error checking saved ads:`, error);
        // Don't fail the search if checking saved ads fails
      }
    }

    // Sort by hotness score
    searchResult.data.sort((a: any, b: any) => {
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
    
      // Save search to history (only if there are results)
      if (searchResult.data.length > 0) {
        try {
          const userId = (req as any).user?._id?.toString();
          if (userId) {
            // Check if Mongoose is connected before attempting to save
            if (mongoose.connection.readyState !== 1) {
              console.log(`[HISTORY] ⚠️ Mongoose not connected (state: ${mongoose.connection.readyState}), skipping history save`);
            } else {
              const searchHistory = new SearchHistory({
                userId,
                searchParams: {
                  searchType: searchParams.searchType,
                  value: searchParams.value,
                  country: searchParams.country || 'CO',
                  minDays: searchParams.minDays || 1,
                  adType: searchParams.adType || 'ALL',
                  mediaType: searchParams.mediaType || 'ALL',
                  searchPhraseType: searchParams.searchPhraseType || 'unordered',
                  languages: searchParams.languages || ['es'],
                  apifyCount: searchParams.apifyCount || 100
                },
                results: {
                  totalAds: searchResult.data.length,
                  totalPages: searchResult.totalPages || 1,
                  source: searchResult.source || 'api',
                  executionTime: Date.now() - searchStartTime,
                  cached: searchResult.message?.includes('cached') || false,
                  // Cache data for instant loading
                  adsData: searchResult.data, // Store the actual ads data
                  paginationData: {
                    currentPage: 1,
                    hasNextPage: searchResult.pagination?.hasNextPage || false,
                    totalResults: searchResult.pagination?.totalResults || searchResult.data.length,
                    cursor: searchResult.cursor
                  },
                  advertiserStats: {} // Will be populated by frontend
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                sessionId: req.sessionID
              });
              
              // Save with timeout and error handling
              await Promise.race([
                searchHistory.save(),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Save timeout after 30 seconds')), 30000)
                )
              ]);
              console.log(`[HISTORY] 💾 Search saved to history for user: ${userId} - ${searchResult.data.length} ads`);
            }
          } else {
            console.log(`[HISTORY] ⚠️ No user ID found, skipping history save`);
          }
        } catch (historyError) {
          console.error(`[HISTORY] ❌ Error saving search to history:`, historyError);
          // Don't fail the search if history saving fails
        }
      } else {
        console.log(`[HISTORY] ⚠️ No results found (${searchResult.data.length} ads), skipping history save`);
      }
    
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
        : `Failed to scrape ads: ${result.error}`
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

    console.log(`[STATS] ✅ Stats retrieval completed: ${(result as any).stats?.totalActiveAds || 0} total ads`);
    
    const responseData = {
      success: (result as any).success,
      pageId,
      advertiserName: (result as any).stats?.advertiserName,
      totalActiveAds: (result as any).stats?.totalActiveAds || 0,
      lastUpdated: (result as any).stats?.lastUpdated,
      executionTime: (result as any).executionTime,
      message: (result as any).success 
        ? `Found ${(result as any).stats?.totalActiveAds || 0} total active ads for ${(result as any).stats?.advertiserName || pageId}`
        : `Failed to get stats: ${(result as any).error}`
    };

    // Cache successful results for 30 minutes
    if ((result as any).success) {
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

// LEGACY PLAYWRIGHT TESTING ROUTES REMOVED
// Now using HTTP-based balancedScraperService instead


// GET /api/ads/load-from-history/:id - Load search from history with cache
router.get('/load-from-history/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = (req as any).user?._id?.toString();
  
  if (!userId) {
    throw new CustomError('Usuario no autenticado', 401);
  }

  console.log(`[HISTORY] 🔄 Loading search from history: ${id} for user: ${userId}`);
  
  try {
    // Find the search in history
    const searchHistory = await SearchHistory.findOne({ 
      _id: id, 
      userId 
    });
    
    if (!searchHistory) {
      throw new CustomError('Búsqueda no encontrada en el historial', 404);
    }

    // Check if cache is still valid (24 hours TTL)
    const cacheAge = Date.now() - searchHistory.searchDate.getTime();
    const cacheTTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    if (cacheAge > cacheTTL) {
      console.log(`[HISTORY] ⚠️ Cache expired for search ${id}, age: ${Math.round(cacheAge / 1000 / 60)} minutes`);
      throw new CustomError('La caché de esta búsqueda ha expirado. Por favor, ejecuta una nueva búsqueda.', 410);
    }

    // Check if we have cached data
    if (!searchHistory.results.adsData || searchHistory.results.adsData.length === 0) {
      console.log(`[HISTORY] ⚠️ No cached data for search ${id}`);
      throw new CustomError('No hay datos en caché para esta búsqueda', 404);
    }

    console.log(`[HISTORY] ✅ Loading cached search: ${searchHistory.results.adsData.length} ads from ${searchHistory.searchDate.toISOString()}`);
    
    // Return the cached search data
    res.json({
      success: true,
      data: searchHistory.results.adsData,
      totalFound: searchHistory.results.totalAds,
      totalPages: searchHistory.results.totalPages,
      source: searchHistory.results.source,
      executionTime: searchHistory.results.executionTime,
      message: `Cargado desde historial (${searchHistory.results.adsData.length} anuncios)`,
      // Pagination data
      pagination: searchHistory.results.paginationData,
      cursor: searchHistory.results.paginationData?.cursor,
      // Metadata
      searchDate: searchHistory.searchDate,
      cached: true,
      fromHistory: true
    });
    
  } catch (error: any) {
    console.error(`[HISTORY] ❌ Error loading search from history:`, error);
    
    if (error instanceof CustomError) {
      throw error;
    }
    
    throw new CustomError('Error al cargar la búsqueda del historial', 500);
  }
}));

export default router;
