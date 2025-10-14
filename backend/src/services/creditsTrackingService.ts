import { collections } from '@/services/database.js';
import { ObjectId } from 'mongodb';

export interface CreditsUsageStats {
  userId: string;
  email: string;
  name: string;
  creditsMonth: number;
  creditsTotal: number;
  plan: string;
  lastUsed: Date | null;
}

export class CreditsTrackingService {
  /**
   * Track credits usage for a user
   */
  async trackCreditsUsage(userId: string, creditsUsed: number = 1): Promise<void> {
    if (!userId || userId === 'system') {
      console.log('🔒 Skipping credits tracking for system or invalid user');
      return;
    }

    try {
      if (!collections.users) {
        throw new Error('Users collection not available');
      }

      const result = await collections.users.updateOne(
        { _id: new ObjectId(userId) } as any,
        {
          $inc: {
            'usage.scrapeCreatorsCreditsMonth': creditsUsed,
            'usage.scrapeCreatorsCreditsTotal': creditsUsed
          },
          $set: {
            'usage.lastUsed': new Date()
          }
        } as any
      );

      if (result.matchedCount === 0) {
        console.warn(`⚠️ User ${userId} not found for credits tracking`);
      } else {
        console.log(`💳 Tracked ${creditsUsed} ScrapeCreators credits for user ${userId}`);
      }
    } catch (error) {
      console.error('❌ Error tracking credits usage:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Track system credits usage (for cron jobs and system operations)
   */
  async trackSystemCreditsUsage(creditsUsed: number = 1): Promise<void> {
    try {
      if (!collections.users) {
        throw new Error('Users collection not available');
      }

      // Create or update a system user record for tracking system credits
      const systemUserId = 'system_credits';
      
      await collections.users.updateOne(
        { _id: systemUserId } as any,
        {
          $inc: {
            'usage.scrapeCreatorsCreditsMonth': creditsUsed,
            'usage.scrapeCreatorsCreditsTotal': creditsUsed
          },
          $set: {
            'usage.lastUsed': new Date(),
            email: 'system@adfinder.com',
            name: 'System Credits',
            plan: { type: 'system' }
          }
        } as any,
        { upsert: true }
      );

      console.log(`🔧 Tracked ${creditsUsed} ScrapeCreators system credits`);
    } catch (error) {
      console.error('❌ Error tracking system credits usage:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Get credits usage for a specific user
   */
  async getUserCreditsUsage(userId: string): Promise<{
    creditsMonth: number;
    creditsTotal: number;
  } | null> {
    try {
      if (!collections.users) {
        return null;
      }

      const user = await collections.users.findOne(
        { _id: new ObjectId(userId) } as any,
        { 
          projection: { 
            'usage.scrapeCreatorsCreditsMonth': 1,
            'usage.scrapeCreatorsCreditsTotal': 1
          }
        } as any
      );

      if (!user) {
        return null;
      }

      return {
        creditsMonth: (user.usage as any)?.scrapeCreatorsCreditsMonth || 0,
        creditsTotal: (user.usage as any)?.scrapeCreatorsCreditsTotal || 0
      };
    } catch (error) {
      console.error('❌ Error getting user credits usage:', error);
      return null;
    }
  }

  /**
   * Get credits usage for all users (admin only)
   */
  async getAllUsersCreditsUsage(): Promise<CreditsUsageStats[]> {
    try {
      if (!collections.users) {
        return [];
      }

      const users = await collections.users.find(
        {},
        {
          projection: {
            email: 1,
            name: 1,
            'usage.scrapeCreatorsCreditsMonth': 1,
            'usage.scrapeCreatorsCreditsTotal': 1,
            'usage.lastUsed': 1,
            'plan.type': 1
          }
        }
      ).sort({ 'usage.scrapeCreatorsCreditsTotal': -1 }).toArray();

      return users.map(user => ({
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
        creditsMonth: (user.usage as any)?.scrapeCreatorsCreditsMonth || 0,
        creditsTotal: (user.usage as any)?.scrapeCreatorsCreditsTotal || 0,
        plan: user.plan?.type || 'free',
        lastUsed: (user.usage as any)?.lastUsed || null
      }));
    } catch (error) {
      console.error('❌ Error getting all users credits usage:', error);
      return [];
    }
  }

  /**
   * Get general statistics about credits usage
   */
  async getCreditsStats(): Promise<{
    totalCreditsThisMonth: number;
    totalCreditsAllTime: number;
    topUsersThisMonth: CreditsUsageStats[];
    topUsersAllTime: CreditsUsageStats[];
    averageCreditsPerUser: number;
    totalUsers: number;
  }> {
    try {
      const allUsers = await this.getAllUsersCreditsUsage();
      
      const totalCreditsThisMonth = allUsers.reduce((sum, user) => sum + user.creditsMonth, 0);
      const totalCreditsAllTime = allUsers.reduce((sum, user) => sum + user.creditsTotal, 0);
      
      const topUsersThisMonth = allUsers
        .sort((a, b) => b.creditsMonth - a.creditsMonth)
        .slice(0, 10);
        
      const topUsersAllTime = allUsers
        .sort((a, b) => b.creditsTotal - a.creditsTotal)
        .slice(0, 10);

      const averageCreditsPerUser = allUsers.length > 0 ? totalCreditsAllTime / allUsers.length : 0;

      return {
        totalCreditsThisMonth,
        totalCreditsAllTime,
        topUsersThisMonth,
        topUsersAllTime,
        averageCreditsPerUser: Math.round(averageCreditsPerUser * 100) / 100,
        totalUsers: allUsers.length
      };
    } catch (error) {
      console.error('❌ Error getting credits stats:', error);
      return {
        totalCreditsThisMonth: 0,
        totalCreditsAllTime: 0,
        topUsersThisMonth: [],
        topUsersAllTime: [],
        averageCreditsPerUser: 0,
        totalUsers: 0
      };
    }
  }

  /**
   * Reset credits for a specific user (admin only)
   */
  async resetUserCredits(userId: string, resetTotal: boolean = false): Promise<boolean> {
    try {
      if (!collections.users) {
        return false;
      }

      const updateFields: any = {
        'usage.scrapeCreatorsCreditsMonth': 0
      };

      if (resetTotal) {
        updateFields['usage.scrapeCreatorsCreditsTotal'] = 0;
      }

      const result = await collections.users.updateOne(
        { _id: new ObjectId(userId) } as any,
        { $set: updateFields } as any
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error('❌ Error resetting user credits:', error);
      return false;
    }
  }
}

// Singleton instance
export const creditsTrackingService = new CreditsTrackingService();
