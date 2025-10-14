import { Request, Response, NextFunction } from 'express';
import { PlanLimitsService } from '../services/planLimitsService.js';
import { CustomError, asyncHandler } from '../middleware/errorHandler.js';

interface AuthenticatedRequest extends Request {
  user?: any; // Use any to avoid type conflicts with existing auth middleware
}

/**
 * Middleware to check tracked advertisers limit before adding
 */
export const checkTrackedAdvertisersLimit = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    throw new CustomError('User not authenticated', 401);
  }

  const limitCheck = await PlanLimitsService.checkTrackedAdvertisersLimit(userId);

  if (!limitCheck.canAdd) {
    const limitText = limitCheck.limit === 0 ? 'no permitido' : limitCheck.limit.toString();
    throw new CustomError(
      `Límite de anunciantes en seguimiento excedido para tu plan (${limitCheck.planType}). Límite: ${limitText}. Actual: ${limitCheck.currentCount}.`,
      403
    );
  }

  // Attach limit info to request for later use
  (req as any).trackedAdvertisersLimit = {
    planType: limitCheck.planType,
    currentCount: limitCheck.currentCount,
    limit: limitCheck.limit
  };

  next();
});

/**
 * Middleware to check saved ads limit before saving
 */
export const checkSavedAdsLimit = (adsToSave: number = 1) => asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    throw new CustomError('User not authenticated', 401);
  }

  const limitCheck = await PlanLimitsService.checkSavedAdsLimit(userId, adsToSave);

  if (!limitCheck.canSave) {
    const limitText = limitCheck.limit === 0 ? 'no permitido' : 
                     limitCheck.limit === -1 ? 'ilimitados' : 
                     limitCheck.limit.toString();
    const remainingText = limitCheck.limit === 0 ? 'no permitido' : 
                         limitCheck.limit === -1 ? 'ilimitados' : 
                         limitCheck.adsRemaining.toString();
    
    throw new CustomError(
      `Límite de anuncios guardados excedido para tu plan (${limitCheck.planType}). Límite: ${limitText}. Actual: ${limitCheck.currentCount}. Restantes: ${remainingText}.`,
      403
    );
  }

  // Attach limit info to request for later use
  (req as any).savedAdsLimit = {
    planType: limitCheck.planType,
    currentCount: limitCheck.currentCount,
    limit: limitCheck.limit,
    adsRemaining: limitCheck.adsRemaining
  };

  next();
});

/**
 * Middleware to add plan limits info to response
 */
export const addPlanLimitsInfo = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    return next();
  }

  try {
    const limits = await PlanLimitsService.getUserLimits(userId);
    
    // Attach limits info to request for response
    (req as any).planLimits = limits;
    
    next();
  } catch (error) {
    // Don't block the request if limits info fails
    console.warn('Could not fetch plan limits info:', error);
    next();
  }
});
