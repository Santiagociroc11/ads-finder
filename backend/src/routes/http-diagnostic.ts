import express from 'express';
import { asyncHandler, CustomError } from '@/middleware/errorHandler.js';
import fetch from 'node-fetch';

const router = express.Router();

// POST /api/http-diagnostic - Test HTTP requests to Facebook with different configurations
router.post('/', asyncHandler(async (req, res) => {
  const { pageId = '1835332883255867', country = 'ALL' } = req.body;

  console.log(`🔍 Testing HTTP requests to Facebook for pageId: ${pageId}`);

  const baseUrl = 'https://www.facebook.com/ads/library/';
  const params = new URLSearchParams({
    active_status: 'active',
    ad_type: 'all',
    country: country,
    is_targeted_country: 'false',
    media_type: 'all',
    search_type: 'page',
    view_all_page_id: pageId
  });
  const url = `${baseUrl}?${params.toString()}`;

  const testConfigs = [
    {
      name: 'Default Chrome',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'Referer': 'https://www.facebook.com/'
      }
    },
    {
      name: 'Mobile Safari',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1.2 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    },
    {
      name: 'Minimal Headers',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    },
    {
      name: 'Firefox',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    }
  ];

  const results = [];

  for (const config of testConfigs) {
    try {
      console.log(`🧪 Testing ${config.name}...`);
      
      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'GET',
        headers: config.headers,
        timeout: 15000,
        redirect: 'follow'
      });
      const endTime = Date.now();

      const responseHeaders = Object.fromEntries(response.headers.entries());
      let responseBody = '';
      
      if (response.ok) {
        responseBody = await response.text();
      }

      results.push({
        config: config.name,
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        responseTime: endTime - startTime,
        contentLength: responseBody.length,
        headers: responseHeaders,
        preview: responseBody.substring(0, 200),
        error: response.ok ? null : `${response.status} ${response.statusText}`
      });

      console.log(`📊 ${config.name}: ${response.status} ${response.statusText} (${endTime - startTime}ms, ${responseBody.length} chars)`);

    } catch (error) {
      console.error(`❌ ${config.name} failed:`, error);
      results.push({
        config: config.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: 0,
        contentLength: 0,
        headers: {},
        preview: '',
        status: 0,
        statusText: 'Network Error'
      });
    }
  }

  // Find the best working configuration
  const workingConfigs = results.filter(r => r.success);
  const bestConfig = workingConfigs.length > 0 
    ? workingConfigs.reduce((best, current) => 
        current.responseTime < best.responseTime ? current : best
      )
    : null;

  res.json({
    pageId,
    country,
    url,
    testResults: results,
    summary: {
      totalTests: testConfigs.length,
      successfulTests: workingConfigs.length,
      failedTests: results.length - workingConfigs.length,
      bestConfig: bestConfig?.config || null,
      averageResponseTime: workingConfigs.length > 0 
        ? Math.round(workingConfigs.reduce((sum, r) => sum + r.responseTime, 0) / workingConfigs.length)
        : 0
    },
    recommendations: workingConfigs.length === 0 
      ? ['All HTTP configurations failed - Facebook may be blocking requests']
      : [
          `Use ${bestConfig?.config} configuration for best results`,
          `${workingConfigs.length}/${testConfigs.length} configurations work`,
          bestConfig ? `Best response time: ${bestConfig.responseTime}ms` : null
        ].filter(Boolean)
  });

}));

export default router;
