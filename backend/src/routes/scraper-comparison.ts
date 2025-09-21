import express from 'express';
import { asyncHandler, CustomError } from '@/middleware/errorHandler.js';
import { balancedScraperService } from '../services/balancedScraperService.js';

const router = express.Router();

// POST /api/scraper-comparison - Test Balanced Scraper
router.post('/', asyncHandler(async (req, res) => {
  const { pageId = '1835332883255867', country = 'ALL' } = req.body;

  console.log(`🔍 Testing Balanced Scraper for pageId: ${pageId}`);

  try {
    // Only Balanced Scraper
    const balancedResult = await balancedScraperService.getAdvertiserStats(pageId, country)
      .catch(error => ({ success: false, error: error.message, executionTime: 0 }));

    // Performance stats
    const balancedStats = balancedScraperService.getPerformanceStats();

    res.json({
      pageId,
      country,
      method: 'Balanced Scraper',
      result: balancedResult,
      performance: {
        pros: ['Better script extraction', 'Moderate concurrency (20)', 'Improved AI prompts', 'Reliable fallback'],
        cons: ['Lower max concurrency than optimized approaches'],
        stats: balancedStats
      },
      analysis: {
        success: balancedResult.success,
        adsFound: (balancedResult as any).stats?.totalActiveAds || 0,
        executionTime: balancedResult.executionTime || 0,
        recommendation: balancedResult.success 
          ? `✅ Balanced Scraper working well - found ${(balancedResult as any).stats?.totalActiveAds || 0} ads`
          : `❌ Balanced Scraper failed - ${balancedResult.error || 'Unknown error'}`
      }
    });

  } catch (error) {
    console.error('[SCRAPER_COMPARISON] ❌ Comparison failed:', error);
    throw new CustomError('Failed to compare scraping methods', 500);
  }
}));

export default router;