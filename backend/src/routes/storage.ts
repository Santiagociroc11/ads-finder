import express from 'express';
import { storageService } from '@/services/storageService.js';
import { authenticateToken } from '@/middleware/authMiddleware.js';
import { asyncHandler, CustomError } from '@/middleware/errorHandler.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/storage/stats - Get storage statistics
router.get('/stats', asyncHandler(async (req, res) => {
  try {
    const stats = await storageService.getStorageStats();
    
    res.json({
      success: true,
      data: {
        bucketName: stats.bucketName,
        totalObjects: stats.totalObjects,
        totalSize: stats.totalSize,
        totalSizeFormatted: formatBytes(stats.totalSize),
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting storage stats:', error);
    throw new CustomError('Error al obtener estadísticas de almacenamiento', 500);
  }
}));

// GET /api/storage/health - Check storage health
router.get('/health', asyncHandler(async (req, res) => {
  try {
    // Try to check if bucket exists
    const stats = await storageService.getStorageStats();
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        bucketName: stats.bucketName,
        accessible: true,
        lastChecked: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Storage health check failed:', error);
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString()
      }
    });
  }
}));

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default router;
