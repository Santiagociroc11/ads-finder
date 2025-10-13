import { collections } from './database.js';
import { User } from '../models/User.js';
import type { User as UserType } from '../types/shared.js';
import { CustomError } from '../middleware/errorHandler.js';

export interface PlanLimitCheck {
  canFetchAds: boolean;
  adsRemaining: number;
  limitExceeded: boolean;
  planType: string;
  currentUsage: number;
  monthlyLimit: number;
}

export class UserLimitsService {
  
  /**
   * Check if user can fetch more ads based on their plan limits
   */
  static async checkAdsLimit(userId: string, requestedAds: number = 1): Promise<PlanLimitCheck> {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      // Ensure usage is up to date (check if month has changed)
      const currentMonth = new Date().toISOString().slice(0, 7);
      if (user.usage.currentMonth !== currentMonth) {
        user.usage.currentMonth = currentMonth;
        user.usage.adsFetched = 0;
        user.usage.searchesPerformed = 0;
        user.usage.lastResetDate = new Date();
        await user.save();
      }

      const currentUsage = user.usage.adsFetched;
      const monthlyLimit = user.plan.adsLimit;
      const adsRemaining = Math.max(0, monthlyLimit - currentUsage);
      const canFetchAds = (currentUsage + requestedAds) <= monthlyLimit;
      const limitExceeded = currentUsage >= monthlyLimit;

      return {
        canFetchAds,
        adsRemaining,
        limitExceeded,
        planType: user.plan.type,
        currentUsage,
        monthlyLimit
      };

    } catch (error) {
      console.error('[USER_LIMITS] ❌ Error checking ads limit:', error);
      throw new CustomError('Error checking user limits', 500);
    }
  }

  /**
   * Increment ads fetched counter for user
   */
  static async incrementAdsFetched(userId: string, adsCount: number): Promise<void> {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      // Ensure usage is up to date
      const currentMonth = new Date().toISOString().slice(0, 7);
      if (user.usage.currentMonth !== currentMonth) {
        user.usage.currentMonth = currentMonth;
        user.usage.adsFetched = 0;
        user.usage.searchesPerformed = 0;
        user.usage.lastResetDate = new Date();
      }

      user.usage.adsFetched += adsCount;
      await user.save();

      console.log(`[USER_LIMITS] 📊 User ${userId} fetched ${adsCount} ads. Total this month: ${user.usage.adsFetched}/${user.plan.adsLimit}`);

    } catch (error) {
      console.error('[USER_LIMITS] ❌ Error incrementing ads fetched:', error);
      throw new CustomError('Error updating user usage', 500);
    }
  }

  /**
   * Increment searches performed counter for user
   */
  static async incrementSearchesPerformed(userId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      // Ensure usage is up to date
      const currentMonth = new Date().toISOString().slice(0, 7);
      if (user.usage.currentMonth !== currentMonth) {
        user.usage.currentMonth = currentMonth;
        user.usage.adsFetched = 0;
        user.usage.searchesPerformed = 0;
        user.usage.lastResetDate = new Date();
      }

      user.usage.searchesPerformed += 1;
      await user.save();

      console.log(`[USER_LIMITS] 🔍 User ${userId} performed search. Total searches this month: ${user.usage.searchesPerformed}`);

    } catch (error) {
      console.error('[USER_LIMITS] ❌ Error incrementing searches performed:', error);
      throw new CustomError('Error updating user usage', 500);
    }
  }

  /**
   * Get user usage statistics
   */
  static async getUserUsage(userId: string): Promise<{
    currentMonth: string;
    adsFetched: number;
    searchesPerformed: number;
    adsRemaining: number;
    monthlyLimit: number;
    planType: string;
    planName: string;
    resetDate: Date;
  }> {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      // Ensure usage is up to date
      const currentMonth = new Date().toISOString().slice(0, 7);
      if (user.usage.currentMonth !== currentMonth) {
        user.usage.currentMonth = currentMonth;
        user.usage.adsFetched = 0;
        user.usage.searchesPerformed = 0;
        user.usage.lastResetDate = new Date();
        await user.save();
      }

      return {
        currentMonth: user.usage.currentMonth,
        adsFetched: user.usage.adsFetched,
        searchesPerformed: user.usage.searchesPerformed,
        adsRemaining: Math.max(0, user.plan.adsLimit - user.usage.adsFetched),
        monthlyLimit: user.plan.adsLimit,
        planType: user.plan.type,
        planName: user.plan.name,
        resetDate: user.usage.lastResetDate
      };

    } catch (error) {
      console.error('[USER_LIMITS] ❌ Error getting user usage:', error);
      throw new CustomError('Error getting user usage', 500);
    }
  }

  /**
   * Upgrade user plan
   */
  static async upgradeUserPlan(userId: string, newPlanType: 'pioneros' | 'tactico' | 'conquista' | 'imperio'): Promise<void> {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      const planConfig = (User as any).getPlanConfig(newPlanType);
      
      user.plan.type = planConfig.type;
      user.plan.name = planConfig.name;
      user.plan.adsLimit = planConfig.adsLimit;
      user.plan.features = planConfig.features;

      // Update subscription info
      user.subscription = {
        status: 'active',
        startDate: new Date(),
        autoRenew: true,
        ...user.subscription
      };

      await user.save();

      console.log(`[USER_LIMITS] ⬆️ User ${userId} upgraded to ${planConfig.name}`);

    } catch (error) {
      console.error('[USER_LIMITS] ❌ Error upgrading user plan:', error);
      throw new CustomError('Error upgrading user plan', 500);
    }
  }

  /**
   * Reset user usage (admin function)
   */
  static async resetUserUsage(userId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      user.usage.adsFetched = 0;
      user.usage.searchesPerformed = 0;
      user.usage.lastResetDate = new Date();
      await user.save();

      console.log(`[USER_LIMITS] 🔄 User ${userId} usage reset by admin`);

    } catch (error) {
      console.error('[USER_LIMITS] ❌ Error resetting user usage:', error);
      throw new CustomError('Error resetting user usage', 500);
    }
  }
}
