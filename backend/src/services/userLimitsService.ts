import { collections } from './database.js';
import { User } from '../models/User.js';
import type { User as UserType } from '../types/shared.js';
import { CustomError } from '../middleware/errorHandler.js';
import { PlanLimitsService } from './planLimitsService.js';

export interface PlanLimitCheck {
  canFetchAds: boolean;
  adsRemaining: number;
  limitExceeded: boolean;
  planType: string;
  currentUsage: number;
  monthlyLimit: number;
  scrapeCreatorsCreditsMonth: number;
  scrapeCreatorsCreditsTotal: number;
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
        user.usage.scrapeCreatorsCreditsMonth = 0;
        // Note: scrapeCreatorsCreditsTotal is NOT reset (historical tracking)
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
        monthlyLimit,
        scrapeCreatorsCreditsMonth: user.usage.scrapeCreatorsCreditsMonth || 0,
        scrapeCreatorsCreditsTotal: user.usage.scrapeCreatorsCreditsTotal || 0
      };

    } catch (error) {
      console.error('[USER_LIMITS] ❌ Error checking ads limit:', error);
      throw new CustomError('Error checking user limits', 500);
    }
  }

  /**
   * Get user usage information
   */
  static async getUserUsage(userId: string): Promise<{
    adsFetched: number;
    monthlyLimit: number;
    adsRemaining: number;
    planType: string;
    planName: string;
    searchesPerformed: number;
    resetDate: string;
  }> {
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
        user.usage.scrapeCreatorsCreditsMonth = 0;
        // Note: scrapeCreatorsCreditsTotal is NOT reset (historical tracking)
        user.usage.lastResetDate = new Date();
        await user.save();
      }

      const currentUsage = user.usage.adsFetched;
      const monthlyLimit = user.plan.adsLimit;
      const adsRemaining = Math.max(0, monthlyLimit - currentUsage);

      // Calculate next reset date (first day of next month)
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      return {
        adsFetched: currentUsage,
        monthlyLimit,
        adsRemaining,
        planType: user.plan.type,
        planName: user.plan.name,
        searchesPerformed: user.usage.searchesPerformed,
        resetDate: nextMonth.toISOString()
      };

    } catch (error) {
      console.error('[USER_LIMITS] ❌ Error getting user usage:', error);
      throw new CustomError('Error getting user usage', 500);
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
        user.usage.scrapeCreatorsCreditsMonth = 0;
        // Note: scrapeCreatorsCreditsTotal is NOT reset (historical tracking)
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
        user.usage.scrapeCreatorsCreditsMonth = 0;
        // Note: scrapeCreatorsCreditsTotal is NOT reset (historical tracking)
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
   * Upgrade user plan
   */
  static async upgradeUserPlan(userId: string, newPlanType: 'free' | 'pioneros' | 'tactico' | 'conquista' | 'imperio'): Promise<void> {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      // Update user plan limits using the new service
      await PlanLimitsService.updateUserPlanLimits(userId, newPlanType);

      // Update subscription info
      user.subscription = {
        status: 'active',
        startDate: new Date(),
        autoRenew: true,
        ...user.subscription
      };

      await user.save();

      console.log(`[USER_LIMITS] ⬆️ User ${userId} upgraded to ${newPlanType}`);

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
