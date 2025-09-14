import express from 'express';
import { FacebookService } from '@/services/facebookService.js';
import { collections } from '@/services/database.js';
import { asyncHandler, CustomError } from '@/middleware/errorHandler.js';
import type { SearchParams, SearchResponse } from '@shared/types/index.js';

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
router.post('/', asyncHandler(async (req, res) => {
  const searchParams: SearchParams = req.body;
  
  // Validate required fields
  if (!searchParams.value) {
    throw new CustomError('El valor de búsqueda es requerido', 400);
  }

  console.log(`[SEARCH] 🔍 Starting search: "${searchParams.value}" (${searchParams.searchType})`);
  
  try {
    // Execute search using FacebookService
    let searchResult: SearchResponse = await getFacebookService().searchAds(searchParams);
    
    // Auto-save complete search for Apify results
    if (searchParams.useApify && searchResult.data.length > 0) {
      try {
        const searchName = `Apify-${searchParams.value}-${searchParams.country || 'CO'}-${new Date().toISOString().split('T')[0]}`;
        
        const existingSearch = await collections.completeSearches().findOne({ searchName });
        
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
          
          await collections.completeSearches().insertOne(completeSearchData as any);
          
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
        const savedAds = await collections.savedAds().find(
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

export default router;
