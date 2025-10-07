import { advertiserStatsService } from '@/services/advertiserStatsService.js';
import { telegramBotService } from '@/services/telegramBotService.js';
import { collections } from '@/services/database.js';
import { ObjectId } from 'mongodb';

interface CronJob {
  id: string;
  advertiserId: string;
  pageId: string;
  pageName: string;
  userId: string;
  priority: number;
  createdAt: Date;
  retryCount: number;
  maxRetries: number;
}

interface CronJobResult {
  success: boolean;
  advertiserId: string;
  pageName: string;
  previousAds: number;
  currentAds: number;
  change: number;
  changePercentage: number;
  error?: string;
  executionTime: number;
}

interface CronQueueStats {
  totalJobs: number;
  processedJobs: number;
  failedJobs: number;
  remainingJobs: number;
  averageProcessingTime: number;
  estimatedTimeRemaining: number;
}

export class CronQueueService {
  private queue: CronJob[] = [];
  private isProcessing = false;
  private processingStats = {
    totalProcessed: 0,
    totalFailed: 0,
    totalExecutionTime: 0,
    startTime: null as Date | null
  };
  
  private readonly PROCESSING_DELAY = 2000; // 2 seconds between requests
  private readonly MAX_CONCURRENT_JOBS = 1; // Process one at a time
  private readonly MAX_RETRIES = 3;

  /**
   * Add advertisers to the cron queue
   */
  async addAdvertisersToQueue(advertisers: any[]): Promise<void> {
    console.log(`📊 Adding ${advertisers.length} advertisers to cron queue`);
    
    // Clear previous queue
    this.queue = [];
    this.resetStats();
    
    // Add advertisers to queue with priority
    advertisers.forEach((advertiser, index) => {
      const job: CronJob = {
        id: `cron-${advertiser._id}-${Date.now()}`,
        advertiserId: advertiser._id.toString(),
        pageId: advertiser.pageId,
        pageName: advertiser.pageName,
        userId: advertiser.userId,
        priority: index, // First come, first served
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: this.MAX_RETRIES
      };
      
      this.queue.push(job);
    });
    
    // Sort by priority
    this.queue.sort((a, b) => a.priority - b.priority);
    
    console.log(`✅ Queue initialized with ${this.queue.length} jobs`);
  }

  /**
   * Start processing the queue
   */
  async processQueue(): Promise<CronJobResult[]> {
    if (this.isProcessing) {
      console.log('📊 Queue already processing, skipping...');
      return [];
    }

    if (this.queue.length === 0) {
      console.log('📊 Queue is empty, nothing to process');
      return [];
    }

    this.isProcessing = true;
    this.processingStats.startTime = new Date();
    const results: CronJobResult[] = [];
    
    console.log(`🚀 Starting to process ${this.queue.length} advertisers...`);
    
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift();
        if (!job) break;
        
        const startTime = Date.now();
        const result = await this.processJob(job);
        const executionTime = Date.now() - startTime;
        
        results.push({
          ...result,
          executionTime
        });
        
        // Update stats
        this.processingStats.totalProcessed++;
        this.processingStats.totalExecutionTime += executionTime;
        
        if (!result.success) {
          this.processingStats.totalFailed++;
          
          // Retry logic
          if (job.retryCount < job.maxRetries) {
            job.retryCount++;
            this.queue.push(job); // Add back to queue for retry
            console.log(`🔄 Retrying job ${job.id} (attempt ${job.retryCount}/${job.maxRetries})`);
          } else {
            console.error(`❌ Job ${job.id} failed after ${job.maxRetries} attempts: ${result.error}`);
          }
        }
        
        // Log progress
        const remaining = this.queue.length;
        const processed = this.processingStats.totalProcessed;
        const total = processed + remaining;
        const progress = Math.round((processed / total) * 100);
        
        console.log(`📊 Progress: ${processed}/${total} (${progress}%) - ${job.pageName}: ${result.previousAds} → ${result.currentAds} (${result.change > 0 ? '+' : ''}${result.change})`);
        
        // Wait before next request (rate limiting)
        if (this.queue.length > 0) {
          await this.delay(this.PROCESSING_DELAY);
        }
      }
      
      // Generate alerts from results
      const alerts = this.generateAlerts(results);
      await this.sendNotifications(alerts);
      
      const totalTime = Date.now() - (this.processingStats.startTime?.getTime() || 0);
      console.log(`✅ Queue processing completed in ${Math.round(totalTime / 1000)}s`);
      console.log(`📊 Processed: ${this.processingStats.totalProcessed}, Failed: ${this.processingStats.totalFailed}`);
      
      return results;
      
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: CronJob): Promise<CronJobResult> {
    try {
      console.log(`📊 Processing: ${job.pageName} (${job.pageId})`);
      
      // Get advertiser from database
      const advertiser = await collections.trackedAdvertisers?.findOne({
        _id: new ObjectId(job.advertiserId)
      });
      
      if (!advertiser) {
        return {
          success: false,
          advertiserId: job.advertiserId,
          pageName: job.pageName,
          previousAds: 0,
          currentAds: 0,
          change: 0,
          changePercentage: 0,
          error: 'Advertiser not found',
          executionTime: 0
        };
      }
      
      // Get real stats from advertiserStatsService
      const statsResult = await advertiserStatsService.getAdvertiserStats(
        job.pageId,
        'ALL'
      );
      
      if (!statsResult.success || !statsResult.stats) {
        return {
          success: false,
          advertiserId: job.advertiserId,
          pageName: job.pageName,
          previousAds: 0,
          currentAds: 0,
          change: 0,
          changePercentage: 0,
          error: statsResult.error || 'Failed to get stats',
          executionTime: 0
        };
      }
      
      const currentActiveAds = statsResult.stats.totalActiveAds || 0;
      
      // Get previous day stats
      const previousStats = advertiser.dailyStats
        ?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
      const previousActiveAds = previousStats?.activeAds || 0;
      
      // Calculate changes
      const change = currentActiveAds - previousActiveAds;
      const changePercentage = previousActiveAds > 0 
        ? ((change / previousActiveAds) * 100) 
        : currentActiveAds > 0 ? 100 : 0;
      
      // Update database
      await this.updateAdvertiserStats(advertiser, currentActiveAds, change);
      
      return {
        success: true,
        advertiserId: job.advertiserId,
        pageName: job.pageName,
        previousAds: previousActiveAds,
        currentAds: currentActiveAds,
        change,
        changePercentage: Math.round(changePercentage),
        executionTime: 0 // Will be set by caller
      };
      
    } catch (error) {
      console.error(`❌ Error processing job ${job.id}:`, error);
      return {
        success: false,
        advertiserId: job.advertiserId,
        pageName: job.pageName,
        previousAds: 0,
        currentAds: 0,
        change: 0,
        changePercentage: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0
      };
    }
  }

  /**
   * Update advertiser stats in database
   */
  private async updateAdvertiserStats(advertiser: any, currentActiveAds: number, change: number): Promise<void> {
    if (!collections.trackedAdvertisers) {
      throw new Error('Database not initialized');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find or create today's stats
    const todayStatsIndex = advertiser.dailyStats.findIndex(
      (stat: any) => new Date(stat.date).getTime() === today.getTime()
    );
    
    const todayStats = {
      date: today,
      activeAds: currentActiveAds,
      newAds: change > 0 ? change : 0,
      totalAds: advertiser.totalAdsTracked + (change > 0 ? change : 0),
      reachEstimate: advertiser.dailyStats[todayStatsIndex]?.reachEstimate,
      avgSpend: advertiser.dailyStats[todayStatsIndex]?.avgSpend,
      change,
      changePercentage: Math.round(((change / (advertiser.dailyStats[todayStatsIndex]?.activeAds || 1)) * 100) || 0)
    };
    
    if (todayStatsIndex >= 0) {
      advertiser.dailyStats[todayStatsIndex] = todayStats;
    } else {
      advertiser.dailyStats.push(todayStats);
    }
    
    // Update totals
    advertiser.totalAdsTracked = todayStats.totalAds;
    advertiser.lastCheckedDate = new Date();
    
    await collections.trackedAdvertisers.updateOne(
      { _id: new ObjectId(advertiser._id) } as any,
      {
        $set: {
          dailyStats: advertiser.dailyStats,
          totalAdsTracked: advertiser.totalAdsTracked,
          lastCheckedDate: advertiser.lastCheckedDate
        }
      }
    );
  }

  /**
   * Generate alerts from processing results
   */
  private generateAlerts(results: CronJobResult[]): any[] {
    const alerts: any[] = [];
    
    for (const result of results) {
      if (!result.success) continue;
      
      const { pageName, changePercentage, currentAds, previousAds } = result;
      
      // Growth alert (+50% or more)
      if (changePercentage >= 50 && currentAds >= 5) {
        alerts.push({
          type: 'growth',
          message: `${pageName} ha aumentado sus anuncios en ${changePercentage}% (${previousAds} → ${currentAds})`,
          severity: 'high',
          changePercentage,
          previousAds,
          currentAds
        });
      }
      
      // Decline alert (-30% or more)
      else if (changePercentage <= -30 && previousAds >= 3) {
        alerts.push({
          type: 'decline',
          message: `${pageName} ha disminuido sus anuncios en ${Math.abs(changePercentage)}% (${previousAds} → ${currentAds})`,
          severity: 'high',
          changePercentage,
          previousAds,
          currentAds
        });
      }
      
      // Inactive alert (0 ads)
      else if (currentAds === 0 && previousAds > 0) {
        alerts.push({
          type: 'inactive',
          message: `${pageName} ya no tiene anuncios activos (anteriormente tenía ${previousAds})`,
          severity: 'medium',
          changePercentage,
          previousAds,
          currentAds
        });
      }
      
      // High activity alert (50+ ads)
      else if (currentAds >= 50) {
        alerts.push({
          type: 'high_activity',
          message: `${pageName} tiene alta actividad con ${currentAds} anuncios activos`,
          severity: 'medium',
          changePercentage,
          previousAds,
          currentAds
        });
      }
    }
    
    return alerts;
  }

  /**
   * Send notifications for high-severity alerts
   */
  private async sendNotifications(alerts: any[]): Promise<void> {
    if (alerts.length === 0 || !telegramBotService.isRunning()) {
      return;
    }

    const highSeverityAlerts = alerts.filter(alert => alert.severity === 'high');
    
    if (highSeverityAlerts.length === 0) {
      return;
    }

    // Get users with Telegram configured
    const usersWithTelegram = await collections.users?.find({
      telegramId: { $exists: true, $ne: null, $ne: '' }
    }).toArray();
    
    if (!usersWithTelegram || usersWithTelegram.length === 0) {
      return;
    }

    // Create alert message
    const message = this.createAlertMessage(highSeverityAlerts);

    // Send to all users
    for (const user of usersWithTelegram) {
      try {
        await telegramBotService.sendMessage(user.telegramId, message);
        console.log(`📱 Alert sent to user ${user.name} (${user.telegramId})`);
      } catch (error) {
        console.error(`❌ Failed to send alert to user ${user.name}:`, error);
      }
    }
  }

  /**
   * Create alert message
   */
  private createAlertMessage(alerts: any[]): string {
    const growthAlerts = alerts.filter(a => a.type === 'growth');
    const declineAlerts = alerts.filter(a => a.type === 'decline');
    const inactiveAlerts = alerts.filter(a => a.type === 'inactive');

    let message = `🚨 *Alertas de Monitoreo Diario*\n\n`;
    
    if (growthAlerts.length > 0) {
      message += `📈 *NICHOS EN CRECIMIENTO:*\n`;
      growthAlerts.forEach(alert => {
        message += `• ${alert.message}\n`;
      });
      message += `\n`;
    }

    if (declineAlerts.length > 0) {
      message += `📉 *NICHOS EN DECLIVE:*\n`;
      declineAlerts.forEach(alert => {
        message += `• ${alert.message}\n`;
      });
      message += `\n`;
    }

    if (inactiveAlerts.length > 0) {
      message += `❄️ *NICHOS INACTIVOS:*\n`;
      inactiveAlerts.forEach(alert => {
        message += `• ${alert.message}\n`;
      });
      message += `\n`;
    }

    message += `💡 *Recomendación:* Revisa estos nichos para decidir si entrar o salir del mercado.`;

    return message;
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): CronQueueStats {
    const totalJobs = this.processingStats.totalProcessed + this.queue.length;
    const averageProcessingTime = this.processingStats.totalProcessed > 0 
      ? this.processingStats.totalExecutionTime / this.processingStats.totalProcessed 
      : 0;
    
    const estimatedTimeRemaining = this.queue.length * averageProcessingTime;
    
    return {
      totalJobs,
      processedJobs: this.processingStats.totalProcessed,
      failedJobs: this.processingStats.totalFailed,
      remainingJobs: this.queue.length,
      averageProcessingTime: Math.round(averageProcessingTime),
      estimatedTimeRemaining: Math.round(estimatedTimeRemaining)
    };
  }

  /**
   * Check if queue is processing
   */
  isProcessingQueue(): boolean {
    return this.isProcessing;
  }

  /**
   * Reset processing statistics
   */
  private resetStats(): void {
    this.processingStats = {
      totalProcessed: 0,
      totalFailed: 0,
      totalExecutionTime: 0,
      startTime: null
    };
  }

  /**
   * Utility for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const cronQueueService = new CronQueueService();
