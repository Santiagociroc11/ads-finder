import { Router } from 'express';
import { Request, Response } from 'express';
import { collections } from '@/services/database.js';
import { AuthService } from '@/services/authService.js';
import { logger } from '@/middleware/logger.js';
import { authenticateToken } from '@/middleware/authMiddleware.js';

const router = Router();

// Update user settings (telegramId)
router.put('/settings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { telegramId } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    if (!collections.users) {
      return res.status(500).json({
        success: false,
        message: 'Base de datos no disponible'
      });
    }

    // Validate telegramId format if provided
    if (telegramId && !/^\d+$/.test(telegramId)) {
      return res.status(400).json({
        success: false,
        message: 'El ID de Telegram debe ser un número'
      });
    }

    // Update user document
    const updateResult = await collections.users.updateOne(
      { _id: new (await import('mongodb')).ObjectId(userId) },
      { 
        $set: { 
          telegramId: telegramId || null,
          updatedAt: new Date().toISOString()
        } 
      }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Get updated user data
    const updatedUser = await collections.users.findOne(
      { _id: new (await import('mongodb')).ObjectId(userId) },
      { projection: { password: 0 } }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    logger.info(`User settings updated for user ${userId}`, {
      userId,
      telegramId: telegramId ? 'provided' : 'removed'
    });

    res.json({
      success: true,
      message: 'Configuración actualizada exitosamente',
      user: {
        _id: updatedUser._id.toString(),
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        telegramId: updatedUser.telegramId,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      }
    });

  } catch (error) {
    logger.error('Error updating user settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Get user settings
router.get('/settings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    if (!collections.users) {
      return res.status(500).json({
        success: false,
        message: 'Base de datos no disponible'
      });
    }

    const user = await collections.users.findOne(
      { _id: new (await import('mongodb')).ObjectId(userId) },
      { projection: { password: 0 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      user: {
        _id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        telegramId: user.telegramId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    logger.error('Error getting user settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

export default router;
