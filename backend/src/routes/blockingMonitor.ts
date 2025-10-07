import { Router } from 'express';
import { authenticateToken } from '@/middleware/authMiddleware.js';
import { asyncHandler } from '@/middleware/errorHandler.js';
import { blockingMonitorService } from '@/services/blockingMonitorService.js';
import { antiDetectionService } from '@/services/antiDetectionService.js';

const router = Router();

/**
 * GET /api/blocking-monitor/stats
 * Get blocking statistics and recommendations
 */
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
  const stats = await blockingMonitorService.getBlockingStats();
  const antiDetectionStatus = antiDetectionService.getStatus();
  
  res.json({
    success: true,
    data: {
      blockingStats: stats,
      antiDetectionStatus,
      recommendations: {
        batchSize: await blockingMonitorService.getRecommendedBatchSize(),
        concurrency: await blockingMonitorService.getRecommendedConcurrency(),
        delay: await blockingMonitorService.getRecommendedDelay()
      }
    }
  });
}));

/**
 * GET /api/blocking-monitor/status
 * Get current anti-detection service status
 */
router.get('/status', authenticateToken, asyncHandler(async (req, res) => {
  const status = antiDetectionService.getStatus();
  
  res.json({
    success: true,
    data: status
  });
}));

/**
 * POST /api/blocking-monitor/reset
 * Reset anti-detection service
 */
router.post('/reset', authenticateToken, asyncHandler(async (req, res) => {
  antiDetectionService.reset();
  
  res.json({
    success: true,
    message: 'Anti-detection service reset successfully'
  });
}));

/**
 * POST /api/blocking-monitor/cleanup
 * Cleanup old blocking events
 */
router.post('/cleanup', authenticateToken, asyncHandler(async (req, res) => {
  const { daysToKeep = 30 } = req.body;
  
  await blockingMonitorService.cleanupOldEvents(daysToKeep);
  
  res.json({
    success: true,
    message: `Cleaned up blocking events older than ${daysToKeep} days`
  });
}));

/**
 * GET /api/blocking-monitor/scraping-performance
 * Get scraping performance statistics
 */
router.get('/scraping-performance', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { balancedScraperService } = await import('@/services/balancedScraperService.js');
    const performanceStats = balancedScraperService.getPerformanceStats();
    
    res.json({
      success: true,
      data: {
        performance: performanceStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * GET /api/blocking-monitor/health
 * Check blocking monitor health
 */
router.get('/health', asyncHandler(async (req, res) => {
  try {
    const stats = await blockingMonitorService.getBlockingStats();
    const status = antiDetectionService.getStatus();
    
    const isHealthy = !status.isCircuitOpen && stats.currentSeverity !== 'critical';
    
    res.json({
      success: true,
      healthy: isHealthy,
      data: {
        blockingStats: stats,
        antiDetectionStatus: status
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

export default router;
