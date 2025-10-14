import express from 'express';
import { asyncHandler, CustomError } from '@/middleware/errorHandler.js';
import { authenticateToken } from '@/middleware/authMiddleware.js';
import { UserLimitsService } from '@/services/userLimitsService.js';
import { User } from '@/models/User.js';

const router = express.Router();

// GET /api/user-plans/usage - Get current user usage information
router.get('/usage', authenticateToken, asyncHandler(async (req, res) => {
  const userId = (req as any).user?._id?.toString();
  
  if (!userId) {
    throw new CustomError('User not authenticated', 401);
  }

  const usageInfo = await UserLimitsService.getUserUsage(userId);
  
  res.json({
    success: true,
    usage: usageInfo
  });
}));

// GET /api/user-plans/limits - Check current user limits
router.get('/limits', authenticateToken, asyncHandler(async (req, res) => {
  const userId = (req as any).user?._id?.toString();
  const { estimatedAds = 20 } = req.query;
  
  if (!userId) {
    throw new CustomError('User not authenticated', 401);
  }

  const limitCheck = await UserLimitsService.checkAdsLimit(userId, parseInt(estimatedAds as string));
  
  res.json({
    success: true,
    limits: limitCheck
  });
}));

// GET /api/user-plans/usage - Get current user usage information
router.get('/usage', authenticateToken, asyncHandler(async (req, res) => {
  const userId = (req as any).user?._id?.toString();
  
  if (!userId) {
    throw new CustomError('User not authenticated', 401);
  }

  const usageInfo = await UserLimitsService.getUserUsage(userId);
  
  res.json({
    success: true,
    usage: usageInfo
  });
}));

// GET /api/user-plans/plans - Get available plans
router.get('/plans', asyncHandler(async (req, res) => {
  const plans = {
    free: {
      type: 'free',
      name: 'GRATIS',
      adsLimit: 100,
      price: 0,
      features: ['Búsquedas básicas', 'Hasta 100 anuncios por mes', 'Soporte por email'],
      popular: false,
      paymentLink: null
    },
    pioneros: {
      type: 'pioneros',
      name: 'PIONEROS',
      adsLimit: 5000,
      price: 14.97,
      features: ['Hasta 5,000 anuncios por mes', '1 anunciante en seguimiento', '30 ads guardados', 'Soporte por email'],
      popular: false,
      paymentLink: 'https://pay.hotmart.com/J102289941H?off=njjfgsha'
    },
    tactico: {
      type: 'tactico',
      name: 'TACTICO',
      adsLimit: 14000,
      price: 27,
      features: ['Hasta 14,000 anuncios por mes', '1 anunciante en seguimiento', '30 ads guardados', 'Análisis de competencia', 'Soporte prioritario'],
      popular: false,
      paymentLink: 'https://pay.hotmart.com/J102289941H?off=eyh033ft'
    },
    conquista: {
      type: 'conquista',
      name: 'CONQUISTA',
      adsLimit: 35000,
      price: 57,
      features: ['Hasta 35,000 anuncios por mes', '10 anunciantes en seguimiento', 'Sin límite de ads guardados', 'Análisis avanzados', 'Exportación completa', 'Soporte prioritario'],
      popular: true,
      paymentLink: 'https://pay.hotmart.com/J102289941H?off=o7ro371x'
    },
    imperio: {
      type: 'imperio',
      name: 'IMPERIO',
      adsLimit: 90000,
      price: 127,
      features: ['Hasta 90,000 anuncios por mes', '50 anunciantes en seguimiento', 'Sin límite de ads guardados', 'Análisis premium', 'Exportación completa', 'API completa', 'Soporte dedicado'],
      popular: false,
      paymentLink: 'https://pay.hotmart.com/J102289941H?off=o7ro371x'
    }
  };
  
  res.json({
    success: true,
    plans: Object.values(plans)
  });
}));

// POST /api/user-plans/upgrade - Upgrade user plan (admin only for now)
router.post('/upgrade', authenticateToken, asyncHandler(async (req, res) => {
  const userId = (req as any).user?._id?.toString();
  const { planType } = req.body;
  
  if (!userId) {
    throw new CustomError('User not authenticated', 401);
  }

  if (!planType || !['pioneros', 'tactico', 'conquista', 'imperio'].includes(planType)) {
    throw new CustomError('Invalid plan type', 400);
  }

  // For now, only allow admins to upgrade plans
  // In the future, this would integrate with a payment system
  const user = await User.findById(userId);
  if (!user || user.role !== 'admin') {
    throw new CustomError('Unauthorized: Only admins can upgrade plans', 403);
  }

  await UserLimitsService.upgradeUserPlan(userId, planType);
  
  res.json({
    success: true,
    message: `Plan upgraded to ${planType} successfully`
  });
}));

// POST /api/user-plans/reset-usage - Reset user usage (admin only)
router.post('/reset-usage', authenticateToken, asyncHandler(async (req, res) => {
  const userId = (req as any).user?._id?.toString();
  const { targetUserId } = req.body;
  
  if (!userId) {
    throw new CustomError('User not authenticated', 401);
  }

  // Only allow admins to reset usage
  const user = await User.findById(userId);
  if (!user || user.role !== 'admin') {
    throw new CustomError('Unauthorized: Only admins can reset usage', 403);
  }

  const resetUserId = targetUserId || userId;
  await UserLimitsService.resetUserUsage(resetUserId);
  
  res.json({
    success: true,
    message: `Usage reset successfully for user ${resetUserId}`
  });
}));

export default router;
