import express from 'express';
import { asyncHandler, CustomError } from '@/middleware/errorHandler.js';
import { monitor } from '../middleware/concurrencyMonitor.js';
import { highConcurrencyScraperService } from '../services/highConcurrencyScraperService.js';

const router = express.Router();

// GET /api/concurrency-monitor - Real-time performance metrics
router.get('/', asyncHandler(async (req, res) => {
  try {
    const systemMetrics = monitor.getMetrics();
    const scraperStats = highConcurrencyScraperService.getPerformanceStats();
    const detailedReport = monitor.getDetailedReport();
    const alerts = monitor.checkAlerts();

    res.json({
      timestamp: new Date().toISOString(),
      system: {
        status: detailedReport.summary.status,
        health: detailedReport.summary.health,
        uptime: detailedReport.summary.uptime
      },
      concurrency: {
        active: systemMetrics.activeRequests,
        peak: systemMetrics.peakConcurrency,
        total: systemMetrics.totalRequests,
        rps: parseFloat(systemMetrics.requestsPerSecond.toFixed(1))
      },
      performance: {
        avgResponseTime: Math.round(systemMetrics.avgResponseTime),
        errorRate: parseFloat(systemMetrics.errorRate.toFixed(2)),
        memoryUsage: systemMetrics.memoryUsage
      },
      scraper: {
        cacheHitRate: scraperStats.cacheHitRate,
        cacheSize: scraperStats.cacheSize,
        activeConnections: scraperStats.activeConnections,
        queuedRequests: scraperStats.queuedRequests,
        batchQueueSize: scraperStats.batchQueueSize,
        avgResponseTime: scraperStats.avgResponseTime,
        totalRequests: scraperStats.totalRequests,
        errors: scraperStats.errors
      },
      alerts: {
        critical: alerts.critical,
        warnings: alerts.warnings,
        hasAlerts: alerts.critical.length > 0 || alerts.warnings.length > 0
      },
      recommendations: detailedReport.recommendations,
      capacityAnalysis: {
        currentLoad: `${systemMetrics.activeRequests}/1000 target capacity`,
        loadPercentage: (systemMetrics.activeRequests / 1000 * 100).toFixed(1),
        canHandle1000Users: systemMetrics.activeRequests < 800 && 
                           systemMetrics.avgResponseTime < 5000 && 
                           systemMetrics.memoryUsage.percentage < 80,
        bottlenecks: [
          ...(systemMetrics.avgResponseTime > 3000 ? ['Response Time'] : []),
          ...(systemMetrics.memoryUsage.percentage > 80 ? ['Memory Usage'] : []),
          ...(systemMetrics.activeRequests > 700 ? ['Concurrency Limit'] : []),
          ...(systemMetrics.errorRate > 10 ? ['Error Rate'] : [])
        ]
      }
    });

  } catch (error) {
    console.error('[CONCURRENCY_MONITOR] ❌ Error getting metrics:', error);
    throw new CustomError('Failed to get concurrency metrics', 500);
  }
}));

// POST /api/concurrency-monitor/reset - Reset metrics
router.post('/reset', asyncHandler(async (req, res) => {
  try {
    monitor.reset();
    highConcurrencyScraperService.clearCache();

    res.json({
      success: true,
      message: 'Concurrency metrics and cache reset successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[CONCURRENCY_MONITOR] ❌ Error resetting metrics:', error);
    throw new CustomError('Failed to reset metrics', 500);
  }
}));

// GET /api/concurrency-monitor/load-test - Simulate load for testing
router.get('/load-test/:requests', asyncHandler(async (req, res) => {
  const { requests } = req.params;
  const numRequests = parseInt(requests) || 10;

  if (numRequests > 100) {
    throw new CustomError('Load test limited to 100 requests for safety', 400);
  }

  console.log(`🧪 Starting load test with ${numRequests} concurrent requests`);

  try {
    const testPageIds = [
      '1835332883255867', // Coca-Cola
      '723236857538710',  // Nike
      '826621413858589',  // McDonald's
      '378134345573131',  // Spotify
      '15087023444'       // Apple
    ];

    const promises = Array.from({ length: numRequests }, (_, i) => {
      const pageId = testPageIds[i % testPageIds.length];
      return highConcurrencyScraperService.getAdvertiserStats(pageId, 'ALL');
    });

    const startTime = Date.now();
    const results = await Promise.allSettled(promises);
    const endTime = Date.now();

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    res.json({
      loadTest: {
        requests: numRequests,
        successful,
        failed,
        successRate: `${(successful / numRequests * 100).toFixed(1)}%`,
        totalTime: `${endTime - startTime}ms`,
        avgTimePerRequest: `${((endTime - startTime) / numRequests).toFixed(0)}ms`
      },
      systemState: monitor.getMetrics(),
      scraperStats: highConcurrencyScraperService.getPerformanceStats()
    });

  } catch (error) {
    console.error('[LOAD_TEST] ❌ Load test failed:', error);
    throw new CustomError('Load test failed', 500);
  }
}));

// GET /api/concurrency-monitor/capacity - Check if system can handle 1000 users
router.get('/capacity', asyncHandler(async (req, res) => {
  const metrics = monitor.getMetrics();
  const scraperStats = highConcurrencyScraperService.getPerformanceStats();

  // Capacity analysis
  const currentCapacity = metrics.activeRequests;
  const targetCapacity = 1000;
  const headroom = targetCapacity - currentCapacity;
  
  const bottlenecks = [];
  const recommendations = [];

  // Analyze bottlenecks
  if (metrics.avgResponseTime > 3000) {
    bottlenecks.push('Response time too high');
    recommendations.push('Optimize database queries and enable more aggressive caching');
  }

  if (metrics.memoryUsage.percentage > 80) {
    bottlenecks.push('Memory usage critical');
    recommendations.push('Scale horizontally or optimize memory usage');
  }

  if (scraperStats.cacheHitRate.replace('%', '') < '80') {
    bottlenecks.push('Cache hit rate too low');
    recommendations.push('Increase cache TTL or implement Redis clustering');
  }

  if (currentCapacity > 700) {
    bottlenecks.push('Already at high concurrency');
    recommendations.push('Implement load balancing across multiple instances');
  }

  const canHandle1000 = bottlenecks.length === 0 && 
                       metrics.avgResponseTime < 2000 && 
                       metrics.memoryUsage.percentage < 70;

  res.json({
    capacity: {
      current: currentCapacity,
      target: targetCapacity,
      headroom,
      percentage: `${(currentCapacity / targetCapacity * 100).toFixed(1)}%`,
      canHandle1000Users: canHandle1000,
      estimatedMaxUsers: canHandle1000 ? '>1000' : Math.round(currentCapacity * 0.8)
    },
    bottlenecks,
    recommendations,
    metrics: {
      responseTime: `${metrics.avgResponseTime.toFixed(0)}ms`,
      memoryUsage: `${metrics.memoryUsage.percentage}%`,
      cacheHitRate: scraperStats.cacheHitRate,
      errorRate: `${metrics.errorRate.toFixed(2)}%`
    },
    optimizations: [
      'Connection pooling: ✅ Enabled',
      'Request batching: ✅ Enabled', 
      'Intelligent caching: ✅ Enabled',
      'AI prompt optimization: ✅ Enabled',
      'Memory management: ✅ Active',
      'Real-time monitoring: ✅ Active'
    ]
  });
}));

export default router;
