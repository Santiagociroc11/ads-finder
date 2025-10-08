import { collections } from '@/services/database.js';
import { ObjectId } from 'mongodb';
import { dailyAdvertiserMonitor } from './dailyAdvertiserMonitor.js';

interface UserAnalysisSchedule {
  userId: string;
  analysisTime: string; // Format: "HH:MM"
  timezone: string; // Default to server timezone
  lastAnalysisDate?: Date;
  nextAnalysisDate?: Date;
}

export class PersonalizedScheduler {
  private isRunning = false;
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Start personalized scheduling for all users
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('📅 Personalized scheduler already running');
      return;
    }

    console.log('📅 Starting personalized analysis scheduler...');
    
    // Wait for database to be ready
    setTimeout(async () => {
      try {
        await this.scheduleAllUsers();
        this.isRunning = true;
        console.log('✅ Personalized scheduler started successfully');
      } catch (error) {
        console.error('❌ Error starting personalized scheduler:', error);
      }
    }, 30000); // Wait 30 seconds for database initialization
  }

  /**
   * Stop all scheduled analysis
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('📅 Stopping personalized scheduler...');
    
    // Clear all intervals
    this.intervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.intervals.clear();
    
    this.isRunning = false;
    console.log('✅ Personalized scheduler stopped');
  }

  /**
   * Schedule analysis for all users based on their preferences
   */
  async scheduleAllUsers(): Promise<void> {
    try {
      const users = await this.getUsersWithAnalysisTime();
      console.log(`📅 Found ${users.length} users with analysis time configured`);

      for (const user of users) {
        await this.scheduleUserAnalysis(user);
      }

      console.log(`✅ Scheduled analysis for ${users.length} users`);
    } catch (error) {
      console.error('❌ Error scheduling users:', error);
    }
  }

  /**
   * Get all users who have analysis time configured
   */
  private async getUsersWithAnalysisTime(): Promise<UserAnalysisSchedule[]> {
    if (!collections.users) {
      return [];
    }

    const users = await collections.users.find({
      analysisTime: { $exists: true, $ne: null }
    }, {
      projection: { _id: 1, analysisTime: 1 }
    }).toArray();

    return users.map(user => ({
      userId: user._id.toString(),
      analysisTime: user.analysisTime || '09:00',
      timezone: 'UTC' // Default to UTC, can be extended later
    }));
  }

  /**
   * Schedule analysis for a specific user
   */
  async scheduleUserAnalysis(user: UserAnalysisSchedule): Promise<void> {
    const intervalId = `user-${user.userId}`;
    
    // Clear existing interval if it exists
    if (this.intervals.has(intervalId)) {
      clearInterval(this.intervals.get(intervalId)!);
    }

    // Calculate next analysis time
    const nextAnalysisTime = this.calculateNextAnalysisTime(user.analysisTime);
    
    console.log(`📅 Scheduling analysis for user ${user.userId} at ${user.analysisTime} (next: ${nextAnalysisTime.toISOString()})`);

    // Schedule the analysis
    const timeout = setTimeout(async () => {
      await this.runUserAnalysis(user.userId);
      // Schedule the next analysis (daily)
      await this.scheduleUserAnalysis(user);
    }, nextAnalysisTime.getTime() - Date.now());

    this.intervals.set(intervalId, timeout);
  }

  /**
   * Calculate the next analysis time based on user's preference
   */
  private calculateNextAnalysisTime(analysisTime: string): Date {
    const now = new Date();
    const [hours, minutes] = analysisTime.split(':').map(Number);
    
    // Create today's analysis time
    const todayAnalysis = new Date(now);
    todayAnalysis.setHours(hours, minutes, 0, 0);
    
    // If today's time has passed, schedule for tomorrow
    if (todayAnalysis <= now) {
      todayAnalysis.setDate(todayAnalysis.getDate() + 1);
    }
    
    return todayAnalysis;
  }

  /**
   * Run analysis for a specific user
   */
  private async runUserAnalysis(userId: string): Promise<void> {
    try {
      console.log(`🚀 Running personalized analysis for user ${userId}`);
      
      // Get user's tracked advertisers
      const advertisers = await this.getUserTrackedAdvertisers(userId);
      
      if (advertisers.length === 0) {
        console.log(`📊 No tracked advertisers found for user ${userId}`);
        return;
      }

      console.log(`📊 Found ${advertisers.length} tracked advertisers for user ${userId}`);
      
      // Run the analysis for this user's advertisers
      await dailyAdvertiserMonitor.runUserAnalysis(userId, advertisers);
      
      console.log(`✅ Personalized analysis completed for user ${userId}`);
    } catch (error) {
      console.error(`❌ Error running analysis for user ${userId}:`, error);
    }
  }

  /**
   * Get tracked advertisers for a specific user
   */
  private async getUserTrackedAdvertisers(userId: string): Promise<any[]> {
    if (!collections.trackedAdvertisers) {
      return [];
    }

    return await collections.trackedAdvertisers.find({
      userId: userId,
      isActive: true
    }).toArray();
  }

  /**
   * Update schedule for a specific user (when they change their analysis time)
   */
  async updateUserSchedule(userId: string, newAnalysisTime: string): Promise<void> {
    console.log(`📅 Updating schedule for user ${userId} to ${newAnalysisTime}`);
    
    // Remove existing schedule
    const intervalId = `user-${userId}`;
    if (this.intervals.has(intervalId)) {
      clearInterval(this.intervals.get(intervalId)!);
      this.intervals.delete(intervalId);
    }

    // Create new schedule
    const user: UserAnalysisSchedule = {
      userId,
      analysisTime: newAnalysisTime,
      timezone: 'UTC'
    };

    await this.scheduleUserAnalysis(user);
    console.log(`✅ Updated schedule for user ${userId}`);
  }

  /**
   * Remove schedule for a user (when they disable analysis)
   */
  async removeUserSchedule(userId: string): Promise<void> {
    console.log(`📅 Removing schedule for user ${userId}`);
    
    const intervalId = `user-${userId}`;
    if (this.intervals.has(intervalId)) {
      clearInterval(this.intervals.get(intervalId)!);
      this.intervals.delete(intervalId);
    }
    
    console.log(`✅ Removed schedule for user ${userId}`);
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    scheduledUsers: number;
    nextAnalysisTimes: Array<{ userId: string; nextTime: Date }>;
  } {
    const nextAnalysisTimes: Array<{ userId: string; nextTime: Date }> = [];
    
    // This is a simplified status - in a real implementation you'd track this better
    return {
      isRunning: this.isRunning,
      scheduledUsers: this.intervals.size,
      nextAnalysisTimes
    };
  }
}

// Global instance
export const personalizedScheduler = new PersonalizedScheduler();
