import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticateToken } from '@/middleware/authMiddleware.js';
import { requireAdmin } from '@/middleware/authMiddleware.js';
import { simpleCronService } from '@/services/simpleCronService.js';
import { dailyAdvertiserMonitor } from '@/services/dailyAdvertiserMonitor.js';
import { cronQueueService } from '@/services/cronQueue.js';

const router = Router();

// GET /api/monitoring/status - Get monitoring status
router.get('/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const cronStatus = simpleCronService.getStatus();
    const queueStats = cronQueueService.getQueueStats();
    const isQueueProcessing = cronQueueService.isProcessingQueue();
    
    res.json({
      success: true,
      data: {
        cron: cronStatus,
        queue: {
          ...queueStats,
          isProcessing: isQueueProcessing
        }
      }
    });
  } catch (error) {
    console.error('Error getting monitoring status:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// POST /api/monitoring/run-daily - Run daily monitoring manually (admin only)
router.post('/run-daily', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    console.log('🔧 Manual daily monitoring triggered by admin');
    await simpleCronService.runDailyMonitoringNow();
    
    res.json({
      success: true,
      message: 'Monitoreo diario ejecutado exitosamente'
    });
  } catch (error) {
    console.error('Error running daily monitoring:', error);
    res.status(500).json({
      success: false,
      message: 'Error al ejecutar el monitoreo diario'
    });
  }
});

// POST /api/monitoring/run-intermediate - Run intermediate monitoring manually (admin only)
router.post('/run-intermediate', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    console.log('🔧 Manual intermediate monitoring triggered by admin');
    await simpleCronService.runIntermediateMonitoringNow();
    
    res.json({
      success: true,
      message: 'Monitoreo intermedio ejecutado exitosamente'
    });
  } catch (error) {
    console.error('Error running intermediate monitoring:', error);
    res.status(500).json({
      success: false,
      message: 'Error al ejecutar el monitoreo intermedio'
    });
  }
});

// GET /api/monitoring/advertisers - Get tracked advertisers with recent stats
router.get('/advertisers', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id.toString();
    
    // Get user's tracked advertisers with recent daily stats
    const { collections } = await import('@/services/database.js');
    
    if (!collections.trackedAdvertisers) {
      return res.status(500).json({
        success: false,
        message: 'Base de datos no disponible'
      });
    }

    const advertisers = await collections.trackedAdvertisers
      .find({ 
        userId,
        isActive: true 
      })
      .sort({ lastCheckedDate: -1 })
      .limit(50)
      .toArray();

    // Add summary statistics for each advertiser
    const advertisersWithStats = advertisers.map(advertiser => {
      const recentStats = advertiser.dailyStats?.slice(-7) || []; // Last 7 days
      const latestStat = recentStats[recentStats.length - 1];
      const previousStat = recentStats[recentStats.length - 2];

      let trend = 'stable';
      let changePercentage = 0;

      if (latestStat && previousStat) {
        const change = latestStat.activeAds - previousStat.activeAds;
        changePercentage = previousStat.activeAds > 0 
          ? (change / previousStat.activeAds) * 100 
          : latestStat.activeAds > 0 ? 100 : 0;

        if (changePercentage > 10) trend = 'growing';
        else if (changePercentage < -10) trend = 'declining';
      }

      return {
        ...advertiser,
        summary: {
          latestActiveAds: latestStat?.activeAds || 0,
          trend,
          changePercentage: Math.round(changePercentage),
          lastChecked: advertiser.lastCheckedDate,
          totalDaysTracked: recentStats.length
        }
      };
    });

    res.json({
      success: true,
      data: {
        advertisers: advertisersWithStats,
        totalTracked: advertisers.length,
        lastUpdated: new Date()
      }
    });

  } catch (error) {
    console.error('Error getting advertisers monitoring data:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

export default router;
