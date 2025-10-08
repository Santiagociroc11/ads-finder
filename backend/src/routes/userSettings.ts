import { Router } from 'express';
import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { collections } from '@/services/database.js';
import { AuthService } from '@/services/authService.js';
import { logger } from '@/middleware/logger.js';
import { authenticateToken } from '@/middleware/authMiddleware.js';
import { telegramBotService } from '@/services/telegramBotService.js';
import { personalizedScheduler } from '@/services/personalizedScheduler.js';

const router = Router();

// Update user settings (telegramId, analysisTime)
router.put('/settings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { telegramId, analysisTime } = req.body;
    const userId = (req as any).user?._id?.toString();

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

    // Validate analysisTime format if provided
    if (analysisTime && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(analysisTime)) {
      return res.status(400).json({
        success: false,
        message: 'La hora de análisis debe estar en formato HH:MM'
      });
    }

    // Update user document
    const updateResult = await collections.users.updateOne(
      { _id: new ObjectId(userId) } as any,
      { 
        $set: { 
          telegramId: telegramId || null,
          analysisTime: analysisTime || '09:00',
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
      { _id: new ObjectId(userId) } as any,
      { projection: { password: 0 } }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

      console.log(`✅ User settings updated for user ${userId}`, {
        userId,
        telegramId: telegramId ? 'provided' : 'removed',
        analysisTime: analysisTime || '09:00'
      });

      // Update personalized scheduler if analysis time changed
      if (analysisTime) {
        try {
          await personalizedScheduler.updateUserSchedule(userId, analysisTime);
          console.log(`📅 Updated analysis schedule for user ${userId} to ${analysisTime}`);
        } catch (error) {
          console.error(`❌ Error updating analysis schedule for user ${userId}:`, error);
          // Don't fail the request if scheduler update fails
        }
      }

    res.json({
      success: true,
      message: 'Configuración actualizada exitosamente',
      user: {
        _id: updatedUser._id.toString(),
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        telegramId: updatedUser.telegramId,
        analysisTime: (updatedUser as any).analysisTime,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Error updating user settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Get user settings
router.get('/settings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id?.toString();

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
      { _id: new ObjectId(userId) } as any,
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
        analysisTime: (user as any).analysisTime,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Error getting user settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Send test notification to user's Telegram
router.post('/settings/test-notification', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id?.toString();

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

    // Get user data
    const user = await collections.users.findOne(
      { _id: new ObjectId(userId) } as any,
      { projection: { password: 0 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (!user.telegramId) {
      return res.status(400).json({
        success: false,
        message: 'No tienes configurado un ID de Telegram'
      });
    }

    if (!telegramBotService.isRunning()) {
      return res.status(503).json({
        success: false,
        message: 'El bot de Telegram no está disponible'
      });
    }

    // Send test message
    const testMessage = `
🧪 *Notificación de Prueba*

¡Hola ${user.name}! 👋

Esta es una notificación de prueba de *Ads Finder Pro*.

✅ Tu configuración de notificaciones está funcionando correctamente.

Ahora recibirás notificaciones cuando:
• Se encuentren nuevos anuncios de anunciantes que sigues
• Haya actualizaciones importantes en tus búsquedas guardadas
• Se generen alertas del sistema

¡Gracias por usar Ads Finder Pro! 🚀
    `.trim();

    await telegramBotService.sendMessage(user.telegramId, testMessage);

    console.log(`✅ Test notification sent to user ${userId} (${user.telegramId})`);

    res.json({
      success: true,
      message: 'Notificación de prueba enviada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error sending test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar la notificación de prueba'
    });
  }
});

// Get scheduler status (admin only)
router.get('/scheduler-status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    // Check if user is admin
    const user = await collections.users?.findOne({ _id: new ObjectId(userId) as any });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Solo administradores pueden ver el estado del scheduler'
      });
    }

    const status = personalizedScheduler.getStatus();
    
    res.json({
      success: true,
      schedulerStatus: status
    });

  } catch (error) {
    console.error('❌ Error getting scheduler status:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

export default router;
