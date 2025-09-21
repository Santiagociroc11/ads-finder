import express from 'express';
import { asyncHandler } from '@/middleware/errorHandler.js';
import { httpPoolService } from '../services/httpPoolService.js';
import { geminiPoolService } from '../services/geminiPoolService.js';
import { multiLevelCache } from '../services/multiLevelCache.js';
import { htmlScraperService } from '../services/htmlScraperService.js';

const router = express.Router();

// GET /api/scalability-monitor - Monitor system performance for 1000 users
router.get('/', asyncHandler(async (req, res) => {
  const httpStats = httpPoolService.getStats();
  const geminiStats = geminiPoolService.getStats();
  const cacheStats = multiLevelCache.getStats();
  
  // Calculate performance metrics
  const performanceScore = calculatePerformanceScore(httpStats, geminiStats, cacheStats);
  const recommendations = generateRecommendations(httpStats, geminiStats, cacheStats);

  res.json({
    timestamp: new Date().toISOString(),
    systemStatus: performanceScore > 80 ? 'excellent' : performanceScore > 60 ? 'good' : performanceScore > 40 ? 'warning' : 'critical',
    performanceScore,
    
    httpPool: {
      ...httpStats,
      utilizationPercent: (httpStats.activeRequests / 100) * 100, // Based on max 100 concurrent
      throughputPerSecond: httpStats.completedRequests / (Date.now() / 1000), // Rough estimate
    },
    
    geminiPool: {
      ...geminiStats,
      utilizationPercent: (geminiStats.activeRequests / 20) * 100, // Based on max 20 concurrent
      successRate: geminiStats.completedRequests / (geminiStats.completedRequests + geminiStats.failedRequests) * 100 || 0,
    },
    
    cache: {
      ...cacheStats,
      efficiency: cacheStats.overallHitRate,
      recommendedAction: cacheStats.overallHitRate < 50 ? 'increase_cache_duration' : 'optimal'
    },

    scalabilityMetrics: {
      estimatedMaxUsers: calculateMaxUsers(httpStats, geminiStats, cacheStats),
      currentLoad: calculateCurrentLoad(httpStats, geminiStats),
      bottleneck: identifyBottleneck(httpStats, geminiStats, cacheStats),
      costPerRequest: calculateCostPerRequest(httpStats, geminiStats, cacheStats)
    },

    recommendations,
    
    realTimeCapacity: {
      httpRequestsPerSecond: Math.max(0, 100 - httpStats.activeRequests), // Available capacity
      geminiRequestsPerSecond: Math.max(0, 20 - geminiStats.activeRequests),
      cacheHitRateTarget: 80, // Target 80% hit rate
      currentCacheHitRate: cacheStats.overallHitRate
    }
  });
}));

function calculatePerformanceScore(httpStats: any, geminiStats: any, cacheStats: any): number {
  let score = 100;
  
  // Penalize high queue sizes
  if (httpStats.queueSize > 50) score -= 20;
  if (geminiStats.queueSize > 10) score -= 15;
  
  // Penalize slow response times
  if (httpStats.avgResponseTime > 5000) score -= 15;
  if (geminiStats.avgResponseTime > 10000) score -= 15;
  
  // Reward high cache hit rates
  if (cacheStats.overallHitRate > 80) score += 10;
  else if (cacheStats.overallHitRate < 50) score -= 20;
  
  // Penalize high failure rates
  const httpFailureRate = httpStats.failedRequests / (httpStats.completedRequests + httpStats.failedRequests) * 100 || 0;
  const geminiFailureRate = geminiStats.failedRequests / (geminiStats.completedRequests + geminiStats.failedRequests) * 100 || 0;
  
  if (httpFailureRate > 10) score -= 25;
  if (geminiFailureRate > 5) score -= 20;
  
  return Math.max(0, Math.min(100, score));
}

function generateRecommendations(httpStats: any, geminiStats: any, cacheStats: any): string[] {
  const recommendations: string[] = [];
  
  if (httpStats.queueSize > 50) {
    recommendations.push('🚨 High HTTP queue - consider increasing maxConcurrentRequests');
  }
  
  if (geminiStats.queueSize > 10) {
    recommendations.push('🤖 High Gemini queue - consider increasing concurrent AI requests');
  }
  
  if (cacheStats.overallHitRate < 60) {
    recommendations.push('💾 Low cache hit rate - increase cache duration or warm popular pages');
  }
  
  if (httpStats.avgResponseTime > 8000) {
    recommendations.push('🐌 Slow HTTP responses - Facebook may be throttling');
  }
  
  if (geminiStats.rateLimitHits > 0) {
    recommendations.push('⏱️ Gemini rate limits detected - implement exponential backoff');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ System performing optimally for current load');
  }
  
  return recommendations;
}

function calculateMaxUsers(httpStats: any, geminiStats: any, cacheStats: any): number {
  // Conservative estimate based on current performance
  const httpCapacity = 100; // Max concurrent HTTP requests
  const geminiCapacity = 20; // Max concurrent Gemini requests
  const cacheMultiplier = Math.max(1, cacheStats.overallHitRate / 100 * 5); // Cache reduces load
  
  // Estimate users per second based on average response times
  const httpUsersPerSecond = httpCapacity / (httpStats.avgResponseTime / 1000 || 5);
  const geminiUsersPerSecond = geminiCapacity / (geminiStats.avgResponseTime / 1000 || 10);
  
  // Take the minimum (bottleneck) and apply cache multiplier
  const bottleneck = Math.min(httpUsersPerSecond, geminiUsersPerSecond);
  
  return Math.floor(bottleneck * cacheMultiplier * 60); // Users per minute
}

function calculateCurrentLoad(httpStats: any, geminiStats: any): number {
  const httpLoad = (httpStats.activeRequests / 100) * 100;
  const geminiLoad = (geminiStats.activeRequests / 20) * 100;
  
  return Math.max(httpLoad, geminiLoad);
}

function identifyBottleneck(httpStats: any, geminiStats: any, cacheStats: any): string {
  if (httpStats.queueSize > geminiStats.queueSize * 2) return 'http_requests';
  if (geminiStats.queueSize > 5) return 'gemini_ai';
  if (cacheStats.overallHitRate < 50) return 'cache_efficiency';
  return 'none';
}

function calculateCostPerRequest(httpStats: any, geminiStats: any, cacheStats: any): {
  httpCost: number;
  geminiCost: number;
  totalCost: number;
} {
  // Estimated costs (adjust based on actual pricing)
  const httpCostPerRequest = 0.001; // Very low - just bandwidth
  const geminiCostPerRequest = 0.01; // Gemini Flash pricing
  
  const totalRequests = httpStats.completedRequests + geminiStats.completedRequests;
  const cacheHitRate = cacheStats.overallHitRate / 100;
  
  // Cache reduces both HTTP and Gemini costs
  const effectiveHttpRequests = httpStats.completedRequests * (1 - cacheHitRate);
  const effectiveGeminiRequests = geminiStats.completedRequests * (1 - cacheHitRate);
  
  return {
    httpCost: effectiveHttpRequests * httpCostPerRequest,
    geminiCost: effectiveGeminiRequests * geminiCostPerRequest,
    totalCost: (effectiveHttpRequests * httpCostPerRequest) + (effectiveGeminiRequests * geminiCostPerRequest)
  };
}

export default router;
