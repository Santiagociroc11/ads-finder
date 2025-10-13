import { Request, Response, NextFunction } from 'express';
import { UserLimitsService } from '../services/userLimitsService.js';
import { CustomError } from './errorHandler.js';

/**
 * Middleware to check if user can fetch more ads based on their plan limits
 */
export const checkAdsLimit = (estimatedAds: number = 20) => {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      
      if (!userId) {
        throw new CustomError('User not authenticated', 401);
      }

      // Check if user can fetch more ads
      const limitCheck = await UserLimitsService.checkAdsLimit(userId, estimatedAds);
      
      if (!limitCheck.canFetchAds) {
        // User has reached their limit
        return res.status(429).json({
          error: 'Límite de anuncios alcanzado',
          message: `Has alcanzado el límite de ${limitCheck.monthlyLimit} anuncios para tu plan ${limitCheck.planName}.`,
          details: {
            planType: limitCheck.planType,
            planName: limitCheck.planName,
            currentUsage: limitCheck.currentUsage,
            monthlyLimit: limitCheck.monthlyLimit,
            adsRemaining: limitCheck.adsRemaining,
            estimatedRequest: estimatedAds
          },
          upgradeRequired: true
        });
      }

      // Add limit info to request for later use
      req.userLimits = limitCheck;
      
      next();

    } catch (error) {
      console.error('[ADS_LIMIT_MIDDLEWARE] ❌ Error checking ads limit:', error);
      
      if (error instanceof CustomError) {
        return res.status(error.statusCode).json({
          error: error.message
        });
      }
      
      return res.status(500).json({
        error: 'Error interno del servidor'
      });
    }
  };
};

/**
 * Middleware to track ads fetched after a successful search
 */
export const trackAdsFetched = () => {
  return async (req: any, res: Response, next: NextFunction) => {
    // Store the original res.json method
    const originalJson = res.json;
    
    // Override res.json to track ads after successful response
    res.json = function(data: any) {
      // Only track if the response is successful and contains ads
      if (res.statusCode === 200 && data?.data && Array.isArray(data.data)) {
        const userId = req.user?._id;
        const adsCount = data.data.length;
        
        if (userId && adsCount > 0) {
          // Track ads fetched asynchronously (don't wait for it)
          UserLimitsService.incrementAdsFetched(userId, adsCount)
            .catch(error => {
              console.error('[ADS_LIMIT_MIDDLEWARE] ❌ Error tracking ads fetched:', error);
              // Don't fail the request if tracking fails
            });
        }
      }
      
      // Call the original json method
      return originalJson.call(this, data);
    };
    
    next();
  };
};

/**
 * Middleware to track searches performed
 */
export const trackSearchPerformed = () => {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      
      if (userId) {
        // Track search performed asynchronously
        UserLimitsService.incrementSearchesPerformed(userId)
          .catch(error => {
            console.error('[ADS_LIMIT_MIDDLEWARE] ❌ Error tracking search performed:', error);
            // Don't fail the request if tracking fails
          });
      }
      
      next();

    } catch (error) {
      console.error('[ADS_LIMIT_MIDDLEWARE] ❌ Error in trackSearchPerformed:', error);
      // Don't fail the request if tracking fails
      next();
    }
  };
};

/**
 * Middleware to add usage information to response
 */
export const addUsageInfo = () => {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      
      if (userId) {
        // Get current usage info
        const usageInfo = await UserLimitsService.getUserUsage(userId);
        
        // Add usage info to request for later use
        req.userUsage = usageInfo;
      }
      
      next();

    } catch (error) {
      console.error('[ADS_LIMIT_MIDDLEWARE] ❌ Error getting usage info:', error);
      // Don't fail the request if getting usage info fails
      next();
    }
  };
};
