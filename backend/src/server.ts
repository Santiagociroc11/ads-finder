import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDatabase } from '@/services/database.js';
import { errorHandler } from '@/middleware/errorHandler.js';
import { logger } from '@/middleware/logger.js';

// Import routes
import adsRoutes from '@/routes/ads.js';
import pagesRoutes from '@/routes/pages.js';
import savedAdsRoutes from '@/routes/savedAds.js';
import completeSearchesRoutes from '@/routes/completeSearches.js';
import suggestionsRoutes from '@/routes/suggestions.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(logger);

// Serve static files (screenshots, etc.)
app.use('/screenshots', express.static(path.join(__dirname, '../screenshots')));

// API Routes
app.use('/api/search', adsRoutes);
app.use('/api/pages', pagesRoutes);
app.use('/api/saved-ads', savedAdsRoutes);
app.use('/api/complete-searches', completeSearchesRoutes);
app.use('/api/suggestions', suggestionsRoutes);

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
