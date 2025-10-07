import dotenv from 'dotenv';
import path from 'path';

// Load environment variables FIRST - Evolution API style
dotenv.config();
console.log(`🔧 Environment loaded from Docker/System variables`);
console.log(`🔧 DOCKER_ENV:`, process.env.DOCKER_ENV || 'false');
console.log(`🔧 FACEBOOK_ACCESS_TOKEN loaded:`, process.env.FACEBOOK_ACCESS_TOKEN ? 'YES' : 'NO');
console.log(`🔧 GEMINI_API_KEY loaded:`, process.env.GEMINI_API_KEY ? 'YES' : 'NO');

// Now import everything else
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';

import { connectDatabase } from '@/services/database.js';
import { redisCacheService } from '@/services/redisCacheService.js';
import { errorHandler } from '@/middleware/errorHandler.js';
import { logger } from '@/middleware/logger.js';
import { apiRateLimit } from '@/middleware/rateLimiter.js';
import { monitoringMiddleware, getHealthData } from '@/middleware/monitoring.js';

// Import routes AFTER dotenv is configured
import adsRoutes from '@/routes/ads.js';
import pagesRoutes from '@/routes/pages.js';
import savedAdsRoutes from '@/routes/savedAds.js';
import completeSearchesRoutes from '@/routes/completeSearches.js';
import suggestionsRoutes from '@/routes/suggestions.js';
import authRoutes from '@/routes/auth.js';
import invitationRoutes from '@/routes/invitation.js';
import concurrencyMonitorRoutes from '@/routes/concurrency-monitor.js';
import scraperComparisonRoutes from '@/routes/scraper-comparison.js';
import httpDiagnosticRoutes from '@/routes/http-diagnostic.js';
import searchHistoryRoutes from '@/routes/searchHistory.js';
import trackedAdvertisersRoutes from '@/routes/trackedAdvertisers.js';
import userSettingsRoutes from '@/routes/userSettings.js';
import monitoringRoutes from '@/routes/monitoring.js';
import { telegramBotService } from '@/services/telegramBotService.js';
import { cronService } from '@/services/cronService.js';
import { monitor } from '@/middleware/concurrencyMonitor.js';

// Verify critical environment variables
if (!process.env.FACEBOOK_ACCESS_TOKEN) {
  console.warn('⚠️  FACEBOOK_ACCESS_TOKEN not found - Facebook API searches will fail');
}
if (!process.env.MONGO_URL) {
  console.warn('⚠️  MONGO_URL not found - using default: mongodb://localhost:27017');
}
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.warn('⚠️  TELEGRAM_BOT_TOKEN not found - Telegram notifications will be disabled');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT; // REQUIRED from .env

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL, // REQUIRED from .env
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(logger);
// app.use(monitor.middleware()); // Concurrency monitoring disabled

// Apply monitoring to all requests
// app.use(monitoringMiddleware); // Performance monitoring disabled

// Apply general rate limiting to all API routes
app.use('/api/', apiRateLimit);

// Serve static files
// Note: Screenshots functionality removed for better performance

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/invitation', invitationRoutes); // RUTA PÚBLICA para tokens
app.use('/api/search', adsRoutes);
app.use('/api/ads', adsRoutes); // Also mount ads routes under /api/ads for scraper endpoints
app.use('/api/pages', pagesRoutes);
app.use('/api/saved-ads', savedAdsRoutes);
app.use('/api/complete-searches', completeSearchesRoutes);
app.use('/api/suggestions', suggestionsRoutes);
app.use('/api/concurrency-monitor', concurrencyMonitorRoutes);
app.use('/api/scraper-comparison', scraperComparisonRoutes);
app.use('/api/http-diagnostic', httpDiagnosticRoutes);
app.use('/api/search-history', searchHistoryRoutes);
app.use('/api/tracked-advertisers', trackedAdvertisersRoutes);
app.use('/api/user', userSettingsRoutes);
app.use('/api/monitoring', monitoringRoutes);

// Health check endpoint with monitoring data
app.get('/api/health', async (req, res) => {
  try {
    const healthData = getHealthData();
    const redisHealthy = await redisCacheService.isHealthy();
    const detailedCacheStats = await redisCacheService.getDetailedCacheStats();
    
    res.json({
      ...healthData,
      database: 'connected',
      redis: {
        connected: redisHealthy,
        cache: detailedCacheStats
      },
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'critical',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}


// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

// Start server
async function startServer(): Promise<void> {
  try {
    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected successfully');

    // Connect to Redis
    await redisCacheService.connect();
    console.log('✅ Redis connected successfully');

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`🚀 Ads Finder Pro Backend running on port ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      }

          // Start Telegram bot
          if (process.env.TELEGRAM_BOT_TOKEN) {
            telegramBotService.start();
            console.log('🤖 Telegram bot started successfully');
          }

          // Start Cron service for daily monitoring
          cronService.start();
          console.log('⏰ Cron service started successfully');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Received SIGINT. Graceful shutdown...');
  
  // Stop Telegram bot
  if (telegramBotService.isRunning()) {
    telegramBotService.stop();
    console.log('🤖 Telegram bot stopped');
  }

  // Stop Cron service
  cronService.stop();
  console.log('⏰ Cron service stopped');
  
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('⏹️  Received SIGTERM. Graceful shutdown...');
  
  // Stop Telegram bot
  if (telegramBotService.isRunning()) {
    telegramBotService.stop();
    console.log('🤖 Telegram bot stopped');
  }

  // Stop Cron service
  cronService.stop();
  console.log('⏰ Cron service stopped');
  
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
