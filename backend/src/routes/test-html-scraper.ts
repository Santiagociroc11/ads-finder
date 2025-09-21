import express from 'express';
import { asyncHandler, CustomError } from '@/middleware/errorHandler.js';
import { htmlScraperService } from '../services/htmlScraperService.js';

const router = express.Router();

// POST /api/test-html-scraper - Test the new HTML+AI scraping approach
router.post('/', asyncHandler(async (req, res) => {
  const { pageId = '1835332883255867', country = 'ALL' } = req.body;

  console.log(`🧪 Testing HTML+AI scraper for pageId: ${pageId}`);

  try {
    const result = await htmlScraperService.getAdvertiserStats({
      pageId,
      country,
      maxRetries: 2
    });

    res.json({
      success: result.success,
      pageId,
      stats: result.stats,
      executionTime: result.executionTime,
      error: result.error,
      method: 'HTTP + Gemini AI',
      message: result.success 
        ? `Successfully analyzed ${result.stats?.totalActiveAds || 0} ads for ${result.stats?.advertiserName || pageId}`
        : `Failed to analyze: ${result.error}`,
      cacheStats: htmlScraperService.getCacheStats()
    });

  } catch (error) {
    console.error(`[HTML_SCRAPER_TEST] ❌ Test failed:`, error);
    throw new CustomError(
      error instanceof Error ? error.message : 'Error testing HTML scraper',
      500
    );
  }
}));

export default router;
