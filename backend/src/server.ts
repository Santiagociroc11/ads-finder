import dotenv from 'dotenv';
import path from 'path';

// Load environment variables FIRST - before any other imports
// Check if we're running from backend/ or root directory
const envPath = process.cwd().endsWith('backend') 
  ? path.join(process.cwd(), '..', '.env')  // Running from backend/
  : path.join(process.cwd(), '.env');        // Running from root
const result = dotenv.config({ path: envPath });
console.log(`🔧 Loading .env from: ${envPath}`);
console.log(`🔧 Dotenv result:`, result.error ? `ERROR: ${result.error.message}` : 'SUCCESS');
console.log(`🔧 FACEBOOK_ACCESS_TOKEN loaded:`, process.env.FACEBOOK_ACCESS_TOKEN ? 'YES' : 'NO');
console.log(`🔧 GEMINI_API_KEY loaded:`, process.env.GEMINI_API_KEY ? 'YES' : 'NO');

// Now import everything else
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';

import { connectDatabase } from '@/services/database.js';
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

// Verify critical environment variables
if (!process.env.FACEBOOK_ACCESS_TOKEN) {
  console.warn('⚠️  FACEBOOK_ACCESS_TOKEN not found - Facebook API searches will fail');
}
if (!process.env.MONGO_URL) {
  console.warn('⚠️  MONGO_URL not found - using default: mongodb://localhost:27017');
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

// Apply monitoring to all requests
app.use(monitoringMiddleware);

// Apply general rate limiting to all API routes
app.use('/api/', apiRateLimit);

// Serve static files
// Note: Screenshots functionality removed for better performance

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/search', adsRoutes);
app.use('/api/ads', adsRoutes); // Also mount ads routes under /api/ads for scraper endpoints
app.use('/api/pages', pagesRoutes);
app.use('/api/saved-ads', savedAdsRoutes);
app.use('/api/complete-searches', completeSearchesRoutes);
app.use('/api/suggestions', suggestionsRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const healthData = getHealthData();
    
    res.json({
      ...healthData,
      database: 'connected', // Simplified for now
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

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

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`🚀 Ads Finder Pro Backend running on port ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Received SIGINT. Graceful shutdown...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('⏹️  Received SIGTERM. Graceful shutdown...');
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
