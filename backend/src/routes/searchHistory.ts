import express from 'express';
import { asyncHandler, CustomError } from '@/middleware/errorHandler.js';
import { SearchHistory } from '@/models/SearchHistory.js';
import { authenticateToken } from '@/middleware/authMiddleware.js';

const router = express.Router();

// GET /api/search-history - Get user's search history
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const userId = (req as any).user?._id?.toString();
  const { page = 1, limit = 20, search, country, dateFrom, dateTo } = req.query;

  if (!userId) {
    throw new CustomError('User not authenticated', 401);
  }

  // Build filter query
  const filter: any = { userId };
  
  if (search) {
    filter['searchParams.value'] = { $regex: search, $options: 'i' };
  }
  
  if (country && country !== 'ALL') {
    filter['searchParams.country'] = country;
  }
  
  if (dateFrom || dateTo) {
    filter.searchDate = {};
    if (dateFrom) {
      filter.searchDate.$gte = new Date(dateFrom as string);
    }
    if (dateTo) {
      filter.searchDate.$lte = new Date(dateTo as string);
    }
  }

  // Calculate pagination
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  // Get search history with pagination and timeout
  const [history, totalCount] = await Promise.all([
    SearchHistory.find(filter)
      .sort({ searchDate: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
      .maxTimeMS(5000), // 5 second timeout
    SearchHistory.countDocuments(filter).maxTimeMS(3000) // 3 second timeout for count
  ]);

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / limitNum);
  const hasNextPage = pageNum < totalPages;
  const hasPrevPage = pageNum > 1;

  res.json({
    history,
    pagination: {
      currentPage: pageNum,
      totalPages,
      totalCount,
      hasNextPage,
      hasPrevPage,
      limit: limitNum
    }
  });
}));

// GET /api/search-history/stats - Get search statistics for user
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
  const userId = (req as any).user?._id?.toString();
  const { period = '30' } = req.query; // days

  if (!userId) {
    throw new CustomError('User not authenticated', 401);
  }

  const days = parseInt(period as string);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get aggregated statistics with timeout
  const stats = await SearchHistory.aggregate([
    {
      $match: {
        userId,
        searchDate: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalSearches: { $sum: 1 },
        totalAds: { $sum: '$results.totalAds' },
        avgAdsPerSearch: { $avg: '$results.totalAds' },
        avgExecutionTime: { $avg: '$results.executionTime' },
        cachedSearches: {
          $sum: { $cond: ['$results.cached', 1, 0] }
        },
        mostSearchedTerms: {
          $push: '$searchParams.value'
        },
        mostSearchedCountries: {
          $push: '$searchParams.country'
        }
      }
    }
  ]).option({ maxTimeMS: 10000 }); // 10 second timeout

  // Get most popular search terms
  const popularTerms = await SearchHistory.aggregate([
    {
      $match: {
        userId,
        searchDate: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$searchParams.value',
        count: { $sum: 1 },
        totalAds: { $sum: '$results.totalAds' }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 10
    }
  ]).option({ maxTimeMS: 8000 }); // 8 second timeout

  // Get most searched countries
  const popularCountries = await SearchHistory.aggregate([
    {
      $match: {
        userId,
        searchDate: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$searchParams.country',
        count: { $sum: 1 },
        totalAds: { $sum: '$results.totalAds' }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 10
    }
  ]).option({ maxTimeMS: 8000 }); // 8 second timeout

  // Get daily search activity
  const dailyActivity = await SearchHistory.aggregate([
    {
      $match: {
        userId,
        searchDate: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$searchDate' },
          month: { $month: '$searchDate' },
          day: { $dayOfMonth: '$searchDate' }
        },
        searches: { $sum: 1 },
        ads: { $sum: '$results.totalAds' }
      }
    },
    {
      $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 }
    },
    {
      $limit: 30
    }
  ]).option({ maxTimeMS: 8000 }); // 8 second timeout

  const result = stats[0] || {
    totalSearches: 0,
    totalAds: 0,
    avgAdsPerSearch: 0,
    avgExecutionTime: 0,
    cachedSearches: 0
  };

  res.json({
    period: `${days} days`,
    summary: {
      totalSearches: result.totalSearches,
      totalAds: result.totalAds,
      avgAdsPerSearch: Math.round(result.avgAdsPerSearch || 0),
      avgExecutionTime: Math.round(result.avgExecutionTime || 0),
      cacheHitRate: result.totalSearches > 0 
        ? Math.round((result.cachedSearches / result.totalSearches) * 100) 
        : 0
    },
    popularTerms,
    popularCountries,
    dailyActivity
  });
}));

// Note: DELETE routes removed for audit and limit control purposes
// Search history cannot be deleted by users to maintain audit trail and limit enforcement

// POST /api/search-history - Save search to history (internal use)
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  const userId = (req as any).user?._id?.toString();
  const { searchParams, results, ipAddress, userAgent, sessionId } = req.body;

  if (!userId) {
    throw new CustomError('User not authenticated', 401);
  }

  const searchHistory = new SearchHistory({
    userId,
    searchParams,
    results,
    ipAddress,
    userAgent,
    sessionId
  });

  await searchHistory.save();

  res.json({
    success: true,
    message: 'Search saved to history',
    id: searchHistory._id
  });
}));

export default router;
