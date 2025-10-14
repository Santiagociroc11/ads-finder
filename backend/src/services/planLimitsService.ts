import { User } from '../models/User.js';
import { TrackedAdvertiser } from '../models/TrackedAdvertiser.js';
import { collections } from './database.js';
import { CustomError } from '../middleware/errorHandler.js';

export class PlanLimitsService {
  /**
   * Check if user can add more tracked advertisers
   */
  static async checkTrackedAdvertisersLimit(userId: string): Promise<{
    canAdd: boolean;
    currentCount: number;
    limit: number;
    planType: string;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new CustomError('Usuario no encontrado', 404);
      }

      // Get current count of tracked advertisers
      const currentCount = await TrackedAdvertiser.countDocuments({ 
        userId, 
        isActive: true 
      });

      const limit = user.plan.trackedAdvertisersLimit;
      const canAdd = limit > 0 && currentCount < limit; // 0 means no tracking allowed

      return {
        canAdd,
        currentCount,
        limit,
        planType: user.plan.type
      };
    } catch (error) {
      console.error('Error checking tracked advertisers limit:', error);
      throw error;
    }
  }

  /**
   * Check if user can save more ads
   */
  static async checkSavedAdsLimit(userId: string, adsToSave: number = 1): Promise<{
    canSave: boolean;
    currentCount: number;
    limit: number;
    planType: string;
    adsRemaining: number;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new CustomError('Usuario no encontrado', 404);
      }

      // Get current count of saved ads
      const currentCount = await collections.savedAds.countDocuments({ userId });

      const limit = user.plan.savedAdsLimit;
      const adsRemaining = limit === 0 ? Infinity : Math.max(0, limit - currentCount);
      const canSave = limit === -1 || (limit > 0 && (currentCount + adsToSave) <= limit); // -1 = unlimited, 0 = no saving allowed

      return {
        canSave,
        currentCount,
        limit,
        planType: user.plan.type,
        adsRemaining
      };
    } catch (error) {
      console.error('Error checking saved ads limit:', error);
      throw error;
    }
  }

  /**
   * Get user's current limits and usage
   */
  static async getUserLimits(userId: string): Promise<{
    planType: string;
    planName: string;
    adsLimit: number;
    trackedAdvertisersLimit: number;
    savedAdsLimit: number;
    currentUsage: {
      adsFetched: number;
      trackedAdvertisers: number;
      savedAds: number;
    };
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new CustomError('Usuario no encontrado', 404);
      }

      // Get current usage counts
      const [trackedAdvertisersCount, savedAdsCount] = await Promise.all([
        TrackedAdvertiser.countDocuments({ userId, isActive: true }),
        collections.savedAds.countDocuments({ userId })
      ]);

      return {
        planType: user.plan.type,
        planName: user.plan.name,
        adsLimit: user.plan.adsLimit,
        trackedAdvertisersLimit: user.plan.trackedAdvertisersLimit,
        savedAdsLimit: user.plan.savedAdsLimit,
        currentUsage: {
          adsFetched: user.usage.adsFetched,
          trackedAdvertisers: trackedAdvertisersCount,
          savedAds: savedAdsCount
        }
      };
    } catch (error) {
      console.error('Error getting user limits:', error);
      throw error;
    }
  }

  /**
   * Update user plan limits when upgrading
   */
  static async updateUserPlanLimits(userId: string, newPlanType: 'free' | 'pioneros' | 'tactico' | 'conquista' | 'imperio'): Promise<void> {
    try {
      const planConfig = (User as any).getPlanConfig(newPlanType);
      
      await User.findByIdAndUpdate(userId, {
        'plan.type': planConfig.type,
        'plan.name': planConfig.name,
        'plan.adsLimit': planConfig.adsLimit,
        'plan.trackedAdvertisersLimit': planConfig.trackedAdvertisersLimit,
        'plan.savedAdsLimit': planConfig.savedAdsLimit,
        'plan.features': planConfig.features
      });

      console.log(`✅ Updated user ${userId} plan limits to ${newPlanType}`);
    } catch (error) {
      console.error('Error updating user plan limits:', error);
      throw error;
    }
  }
}
