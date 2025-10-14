import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '@/middleware/authMiddleware.js';
import { creditsTrackingService } from '@/services/creditsTrackingService.js';

const router = Router();

// GET /api/admin/credits/stats - Get general credits statistics
router.get('/stats', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await creditsTrackingService.getCreditsStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting credits stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas de créditos'
    });
  }
});

// GET /api/admin/credits/users - Get credits usage by all users (sorted)
router.get('/users', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await creditsTrackingService.getAllUsersCreditsUsage();
    
    // Sort by total credits (descending)
    const sortedUsers = users.sort((a, b) => b.creditsTotal - a.creditsTotal);
    
    res.json({
      success: true,
      data: {
        users: sortedUsers,
        total: sortedUsers.length,
        totalCreditsThisMonth: sortedUsers.reduce((sum, user) => sum + user.creditsMonth, 0),
        totalCreditsAllTime: sortedUsers.reduce((sum, user) => sum + user.creditsTotal, 0)
      }
    });
  } catch (error) {
    console.error('Error getting users credits usage:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener consumo de créditos por usuario'
    });
  }
});

// GET /api/admin/credits/user/:userId - Get credits usage for specific user
router.get('/user/:userId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const usage = await creditsTrackingService.getUserCreditsUsage(userId);
    
    if (!usage) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    console.error('Error getting user credits usage:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener consumo de créditos del usuario'
    });
  }
});

// POST /api/admin/credits/reset/:userId - Reset credits for specific user
router.post('/reset/:userId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { resetTotal = false } = req.body;
    
    const success = await creditsTrackingService.resetUserCredits(userId, resetTotal);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: resetTotal 
        ? 'Créditos del usuario resetados completamente'
        : 'Créditos mensuales del usuario resetados'
    });
  } catch (error) {
    console.error('Error resetting user credits:', error);
    res.status(500).json({
      success: false,
      message: 'Error al resetear créditos del usuario'
    });
  }
});

export default router;
