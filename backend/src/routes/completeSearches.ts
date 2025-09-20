import express from 'express';
import { ObjectId } from 'mongodb';
import { collections } from '@/services/database.js';
import { asyncHandler, CustomError } from '@/middleware/errorHandler.js';
import type { 
  CompleteSearch, 
  CompleteSearchListItem,
  SearchStats,
  PaginationInfo,
  CompleteSearchWithPagination 
} from '../types/shared.js';

const router = express.Router();

// POST /api/complete-searches - Save a complete search
router.post('/', asyncHandler(async (req, res) => {
  const { searchName, searchParams, results, source, metadata } = req.body;
  
  if (!searchName || !results || !Array.isArray(results)) {
    throw new CustomError('El nombre de búsqueda y los resultados son requeridos', 400);
  }

  // Check if search name already exists
  const existingSearch = await collections.completeSearches.findOne({ searchName });
  if (existingSearch) {
    throw new CustomError('Ya existe una búsqueda con este nombre', 409);
  }

  const newCompleteSearch: Omit<CompleteSearch, '_id'> = {
    searchName,
    searchParams: searchParams || {},
    executedAt: new Date().toISOString(),
    source: source || 'unknown',
    totalResults: results.length,
    results,
    metadata: {
      country: searchParams?.country || 'N/A',
      searchTerm: searchParams?.value || 'N/A',
      minDays: searchParams?.minDays || 0,
      adType: searchParams?.adType || 'ALL',
      useApify: searchParams?.useApify || false,
      ...metadata
    },
    stats: {
      avgHotnessScore: results.length > 0 ? results.reduce((sum: number, ad: any) => sum + (ad.hotness_score || 0), 0) / results.length : 0,
      longRunningAds: results.filter((ad: any) => ad.is_long_running).length,
      topPages: [...new Set(results.map((ad: any) => ad.page_name))].slice(0, 10)
    },
    lastAccessed: new Date().toISOString(),
    accessCount: 0
  };

  const result = await collections.completeSearches.insertOne(newCompleteSearch as any);
  
  console.log(`[COMPLETE_SEARCH] ✅ Complete search saved: "${searchName}" with ${results.length} ads`);
  
  res.status(201).json({
    ...newCompleteSearch,
    _id: result.insertedId,
    message: `Búsqueda completa guardada: ${results.length} anuncios`
  });
}));

// GET /api/complete-searches - List all complete searches
router.get('/', asyncHandler(async (req, res) => {
  const { sortBy, limit } = req.query;
  
  // Configure sorting
  let sort: Record<string, 1 | -1> = {};
  switch (sortBy) {
    case 'executedAt':
      sort = { executedAt: -1 };
      break;
    case 'totalResults':
      sort = { totalResults: -1 };
      break;
    case 'lastAccessed':
      sort = { lastAccessed: -1 };
      break;
    case 'searchName':
      sort = { searchName: 1 };
      break;
    default:
      sort = { executedAt: -1 };
  }
  
  // Projection to exclude results (only metadata)
  const projection = {
    searchName: 1,
    searchParams: 1,
    executedAt: 1,
    source: 1,
    totalResults: 1,
    metadata: 1,
    stats: 1,
    lastAccessed: 1,
    accessCount: 1
    // results: 0  // Explicitly exclude results
  };
  
  let query = collections.completeSearches.find({}, { projection }).sort(sort);
  if (limit) {
    query = query.limit(parseInt(limit as string));
  }
  
  const completeSearches = await query.toArray();
  
  // Enrich searches with additional info
  const enrichedSearches: CompleteSearchListItem[] = completeSearches.map(search => ({
    ...search,
    searchSummary: `${search.metadata.searchTerm} | ${search.metadata.country} | ${search.totalResults} ads | ${search.source}`,
    isRecent: search.executedAt && (new Date().getTime() - new Date(search.executedAt).getTime()) < (7 * 24 * 60 * 60 * 1000), // Last 7 days
    costSavings: search.source === 'apify_scraping' ? '💰 Evita re-ejecutar Apify' : ''
  } as CompleteSearchListItem));
  
  // Global stats
  const globalStats = await collections.completeSearches.aggregate([
    {
      $group: {
        _id: null,
        totalSearches: { $sum: 1 },
        totalAds: { $sum: '$totalResults' },
        apifySearches: { $sum: { $cond: [{ $eq: ['$source', 'apify_scraping'] }, 1, 0] } },
        avgAdsPerSearch: { $avg: '$totalResults' }
      }
    }
  ]).toArray();
  
  res.json({
    searches: enrichedSearches,
    stats: globalStats[0] || { totalSearches: 0, totalAds: 0, apifySearches: 0, avgAdsPerSearch: 0 }
  });
}));

// GET /api/complete-searches/:id - Get specific complete search with pagination
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;
  
  if (!ObjectId.isValid(id)) {
    throw new CustomError('ID de búsqueda inválido', 400);
  }
  
  const completeSearch = await collections.completeSearches.findOne({ _id: new ObjectId(id || '') });
  
  if (!completeSearch) {
    throw new CustomError('Búsqueda completa no encontrada', 404);
  }
  
  // Update access statistics
  await collections.completeSearches.updateOne(
    { _id: new ObjectId(id || '') },
    {
      $set: { lastAccessed: new Date().toISOString() },
      $inc: { accessCount: 1 }
    }
  );
  
  // Pagination
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;
  
  const paginatedResults = completeSearch.results.slice(startIndex, endIndex);
  
  const pagination: PaginationInfo = {
    currentPage: pageNum,
    totalPages: Math.ceil(completeSearch.totalResults / limitNum),
    totalResults: completeSearch.totalResults,
    resultsPerPage: limitNum,
    hasNextPage: endIndex < completeSearch.totalResults,
    hasPrevPage: pageNum > 1
  };
  
  console.log(`[COMPLETE_SEARCH] 📖 Loading search "${completeSearch.searchName}": page ${pageNum}, ${paginatedResults.length} ads`);
  
  const response: CompleteSearchWithPagination = {
    ...completeSearch,
    results: paginatedResults,
    pagination,
    message: 'Búsqueda cargada desde caché - Sin costo adicional'
  };
  
  res.json(response);
}));

// DELETE /api/complete-searches/:id - Delete a complete search
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!ObjectId.isValid(id)) {
    throw new CustomError('ID de búsqueda inválido', 400);
  }
  
  const completeSearch = await collections.completeSearches.findOne({ _id: new ObjectId(id || '') });
  
  if (!completeSearch) {
    throw new CustomError('Búsqueda completa no encontrada', 404);
  }
  
  await collections.completeSearches.deleteOne({ _id: new ObjectId(id || '') });
  
  console.log(`[COMPLETE_SEARCH] 🗑️ Complete search deleted: "${completeSearch.searchName}" (${completeSearch.totalResults} ads)`);
  
  res.json({
    message: `Búsqueda "${completeSearch.searchName}" eliminada exitosamente`,
    deletedResults: completeSearch.totalResults
  });
}));

// GET /api/complete-searches/search - Search in saved searches
router.get('/search', asyncHandler(async (req, res) => {
  const { q, source, country, minResults } = req.query;
  
  let filter: any = {};
  
  // Text filter
  if (q) {
    filter.$or = [
      { searchName: { $regex: q, $options: 'i' } },
      { 'metadata.searchTerm': { $regex: q, $options: 'i' } }
    ];
  }
  
  // Source filter
  if (source) {
    filter.source = source;
  }
  
  // Country filter
  if (country) {
    filter['metadata.country'] = country;
  }
  
  // Minimum results filter
  if (minResults) {
    filter.totalResults = { $gte: parseInt(minResults as string) };
  }
  
  const searches = await collections.completeSearches
    .find(filter, {
      projection: {
        results: 0 // Don't include full results in search
      }
    })
    .sort({ executedAt: -1 })
    .limit(50)
    .toArray();
  
  res.json({
    searches,
    total: searches.length,
    query: { q, source, country, minResults }
  });
}));

// GET /api/complete-searches/stats - Get detailed statistics
router.get('/stats', asyncHandler(async (req, res) => {
  // Overview stats
  const stats = await collections.completeSearches.aggregate([
    {
      $group: {
        _id: null,
        totalSearches: { $sum: 1 },
        totalAds: { $sum: '$totalResults' },
        avgAdsPerSearch: { $avg: '$totalResults' },
        apifySearches: { $sum: { $cond: [{ $eq: ['$source', 'apify_scraping'] }, 1, 0] } },
        apiSearches: { $sum: { $cond: [{ $eq: ['$source', 'facebook_api'] }, 1, 0] } },
        totalAccesses: { $sum: '$accessCount' },
        avgHotness: { $avg: '$stats.avgHotnessScore' }
      }
    }
  ]).toArray();
  
  // Top countries
  const topCountries = await collections.completeSearches.aggregate([
    { $group: { _id: '$metadata.country', count: { $sum: 1 }, totalAds: { $sum: '$totalResults' } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]).toArray();
  
  // Top search terms
  const topTerms = await collections.completeSearches.aggregate([
    { $group: { _id: '$metadata.searchTerm', count: { $sum: 1 }, totalAds: { $sum: '$totalResults' } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]).toArray();
  
  // Most accessed searches
  const mostAccessed = await collections.completeSearches.aggregate([
    { $match: { accessCount: { $gt: 0 } } },
    { $sort: { accessCount: -1 } },
    { $limit: 5 },
    { $project: { searchName: 1, accessCount: 1, totalResults: 1, source: 1 } }
  ]).toArray();
  
  // Estimated cost savings
  const apifySearchCount = stats[0]?.apifySearches || 0;
  const avgApifyResults = await collections.completeSearches.aggregate([
    { $match: { source: 'apify_scraping' } },
    { $group: { _id: null, avgResults: { $avg: '$totalResults' } } }
  ]).toArray();
  
  const estimatedCostSavings = apifySearchCount * 0.05; // Estimated $0.05 per search
  
  const searchStats: SearchStats = {
    overview: stats[0] || {
      totalSearches: 0,
      totalAds: 0,
      avgAdsPerSearch: 0,
      apifySearches: 0,
      apiSearches: 0,
      totalAccesses: 0,
      avgHotness: 0
    },
    costSavings: {
      apifySearchesSaved: apifySearchCount,
      estimatedSavings: `$${estimatedCostSavings.toFixed(2)}`,
      avgResultsPerApify: avgApifyResults[0]?.avgResults || 0
    },
    topCountries,
    topTerms,
    mostAccessed,
    message: `${apifySearchCount} búsquedas Apify guardadas - Evita re-ejecutar búsquedas costosas`
  };
  
  res.json(searchStats);
}));

export default router;
