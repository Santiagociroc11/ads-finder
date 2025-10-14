import { advertiserStatsService } from '@/services/advertiserStatsService.js';
import { telegramBotService } from '@/services/telegramBotService.js';
import { collections } from '@/services/database.js';
import { ObjectId } from 'mongodb';
import { antiDetectionService } from '@/services/antiDetectionService.js';
import { blockingMonitorService } from '@/services/blockingMonitorService.js';

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
  
  private readonly PROCESSING_DELAY = 500; // 500ms between batches
  private readonly MAX_CONCURRENT_JOBS = 10; // Process 10 advertisers simultaneously
  private readonly BATCH_SIZE = 10; // Process advertisers in batches of 10
  private readonly MAX_RETRIES = 2; // Reduced retries for faster processing
  private readonly BATCH_DELAY = 1000; // 1 second between batches

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
   * Start processing the queue with optimized batch processing
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
    
    // Get dynamic parameters based on blocking patterns
    const blockingStats = await blockingMonitorService.getBlockingStats();
    const recommendedBatchSize = await blockingMonitorService.getRecommendedBatchSize();
    const recommendedConcurrency = await blockingMonitorService.getRecommendedConcurrency();
    const recommendedDelay = await blockingMonitorService.getRecommendedDelay();

    // Adjust parameters based on blocking patterns
    const dynamicBatchSize = Math.min(recommendedBatchSize, this.BATCH_SIZE);
    const dynamicConcurrency = Math.min(recommendedConcurrency, this.MAX_CONCURRENT_JOBS);
    const dynamicDelay = Math.max(recommendedDelay, this.BATCH_DELAY);

    console.log(`🚀 Starting optimized batch processing for ${this.queue.length} advertisers...`);
    console.log(`📊 Blocking stats: ${blockingStats.totalBlockings} blockings, severity: ${blockingStats.currentSeverity}`);
    console.log(`⚙️  Dynamic params: batch=${dynamicBatchSize}, concurrency=${dynamicConcurrency}, delay=${dynamicDelay}ms`);
    
    try {
      // Process advertisers in batches with dynamic size
      const batches = this.createBatches(this.queue, dynamicBatchSize);
      console.log(`📊 Created ${batches.length} batches for processing`);
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`📊 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} advertisers)`);
        
        // Process batch with dynamic concurrency
        const batchResults = await this.processBatchWithDynamicConcurrency(batch, dynamicConcurrency);
        results.push(...batchResults);
        
        // Update stats
        this.processingStats.totalProcessed += batchResults.length;
        this.processingStats.totalExecutionTime += batchResults.reduce((sum, r) => sum + r.executionTime, 0);
        
        // Log progress
        const totalProcessed = this.processingStats.totalProcessed;
        const totalJobs = this.queue.length + totalProcessed;
        const progress = Math.round((totalProcessed / totalJobs) * 100);
        
        console.log(`📊 Batch ${batchIndex + 1} completed: ${batchResults.length} processed, Progress: ${totalProcessed}/${totalJobs} (${progress}%)`);
        
        // Wait between batches with dynamic delay
        if (batchIndex < batches.length - 1) {
          await this.delay(dynamicDelay);
        }
      }
      
      // Generate alerts from results
      const alerts = this.generateAlerts(results);
      await this.sendNotifications(alerts);
      
      const totalTime = Date.now() - (this.processingStats.startTime?.getTime() || 0);
      const avgTimePerAdvertiser = totalTime / results.length;
      const estimatedTimeFor500 = avgTimePerAdvertiser * 500 / 1000; // in seconds
      
      console.log(`✅ Optimized queue processing completed in ${Math.round(totalTime / 1000)}s`);
      console.log(`📊 Processed: ${this.processingStats.totalProcessed}, Failed: ${this.processingStats.totalFailed}`);
      console.log(`📊 Average time per advertiser: ${Math.round(avgTimePerAdvertiser)}ms`);
      console.log(`📊 Estimated time for 500 advertisers: ${Math.round(estimatedTimeFor500)}s (${Math.round(estimatedTimeFor500 / 60)} minutes)`);
      
      return results;
      
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Create batches from the queue
   */
  private createBatches(jobs: CronJob[], batchSize: number): CronJob[][] {
    const batches: CronJob[][] = [];
    for (let i = 0; i < jobs.length; i += batchSize) {
      batches.push(jobs.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a batch of jobs with controlled concurrency
   */
  private async processBatch(batch: CronJob[]): Promise<CronJobResult[]> {
    const results: CronJobResult[] = [];
    
    // Process jobs in parallel with controlled concurrency
    const chunks = this.createBatches(batch, this.MAX_CONCURRENT_JOBS);
    
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(job => this.processJobWithRetry(job));
      const chunkResults = await Promise.allSettled(chunkPromises);
      
      // Process results
      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Create error result
          const job = chunk[index];
          results.push({
            success: false,
            advertiserId: job.advertiserId,
            pageName: job.pageName,
            previousAds: 0,
            currentAds: 0,
            change: 0,
            changePercentage: 0,
            error: result.reason?.message || 'Unknown error',
            executionTime: 0
          });
        }
      });
      
      // Small delay between chunks within a batch
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await this.delay(this.PROCESSING_DELAY);
      }
    }
    
    return results;
  }

  /**
   * Process a batch of jobs with dynamic concurrency
   */
  private async processBatchWithDynamicConcurrency(batch: CronJob[], concurrency: number): Promise<CronJobResult[]> {
    const results: CronJobResult[] = [];
    
    // Process jobs in parallel with dynamic concurrency
    const chunks = this.createBatches(batch, concurrency);
    
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(job => this.processJobWithRetry(job));
      const chunkResults = await Promise.allSettled(chunkPromises);
      
      // Process results
      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Create error result
          const job = chunk[index];
          results.push({
            success: false,
            advertiserId: job.advertiserId,
            pageName: job.pageName,
            previousAds: 0,
            currentAds: 0,
            change: 0,
            changePercentage: 0,
            error: result.reason?.message || 'Unknown error',
            executionTime: 0
          });
        }
      });
      
      // Small delay between chunks within a batch
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await this.delay(this.PROCESSING_DELAY);
      }
    }
    
    return results;
  }

  /**
   * Process a single job with retry logic and blocking detection
   */
  private async processJobWithRetry(job: CronJob): Promise<CronJobResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= job.maxRetries; attempt++) {
      try {
        // Check if we're blocked before processing
        const antiDetectionStatus = antiDetectionService.getStatus();
        if (antiDetectionStatus.isCircuitOpen) {
          const waitTime = Math.ceil((antiDetectionStatus.circuitOpenUntil - Date.now()) / 1000);
          console.log(`🚫 Circuit breaker is open, waiting ${waitTime} seconds...`);
          await this.delay(waitTime * 1000);
        }
        
        const startTime = Date.now();
        const result = await this.processJob(job);
        const executionTime = Date.now() - startTime;
        
        return {
          ...result,
          executionTime
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Check if it's a blocking error
        const isBlockingError = lastError.message.includes('Blocked:') || 
          lastError.message.includes('rate_limit') ||
          lastError.message.includes('ip_blocked') ||
          lastError.message.includes('captcha');
        
        if (isBlockingError) {
          console.warn(`🚫 Blocking detected for job ${job.id}, applying extended delay...`);
          // Reset anti-detection service and wait longer
          antiDetectionService.reset();
          await this.delay(30000); // Wait 30 seconds for blocking
        }
        
        if (attempt < job.maxRetries) {
          const baseDelay = isBlockingError ? 30000 : 1000; // Longer delay for blocking
          const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 300000); // Max 5 minutes
          console.log(`🔄 Retrying job ${job.id} (attempt ${attempt + 1}/${job.maxRetries}) in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }
    
    // All retries failed
    return {
      success: false,
      advertiserId: job.advertiserId,
      pageName: job.pageName,
      previousAds: 0,
      currentAds: 0,
      change: 0,
      changePercentage: 0,
      error: lastError?.message || 'Max retries exceeded',
      executionTime: 0
    };
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
      
      // Update database with profile image processing
      await this.updateAdvertiserStats(advertiser, currentActiveAds, change, statsResult.stats);
      
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
   * Update advertiser stats in database with profile image processing
   */
  private async updateAdvertiserStats(advertiser: any, currentActiveAds: number, change: number, statsData?: any): Promise<void> {
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
    
    // Process profile image if available in stats data
    if (statsData && statsData.pageProfilePictureUrl) {
      try {
        const minioImageUrl = await advertiserStatsService.processProfileImage(
          statsData.pageProfilePictureUrl, 
          advertiser.pageId
        );
        
        if (minioImageUrl) {
          advertiser.pageProfilePictureUrl = minioImageUrl;
          console.log(`🖼️ Updated profile image to MinIO for ${advertiser.pageName}`);
        }
      } catch (error) {
        console.log(`⚠️ Failed to update profile image for ${advertiser.pageName}:`, error);
        // Continue without failing the entire job
      }
    }
    
    // Update other profile data if available
    if (statsData) {
      if (statsData.pageProfileUri) {
        advertiser.pageProfileUri = statsData.pageProfileUri;
      }
      if (statsData.pageLikeCount !== undefined) {
        advertiser.pageLikeCount = statsData.pageLikeCount;
      }
      if (statsData.pageCategories) {
        advertiser.pageCategories = statsData.pageCategories;
      }
      if (statsData.pageVerification !== undefined) {
        advertiser.pageVerification = statsData.pageVerification;
      }
    }
    
    await collections.trackedAdvertisers.updateOne(
      { _id: new ObjectId(advertiser._id) } as any,
      {
        $set: {
          dailyStats: advertiser.dailyStats,
          totalAdsTracked: advertiser.totalAdsTracked,
          lastCheckedDate: advertiser.lastCheckedDate,
          pageProfilePictureUrl: advertiser.pageProfilePictureUrl,
          pageProfileUri: advertiser.pageProfileUri,
          pageLikeCount: advertiser.pageLikeCount,
          pageCategories: advertiser.pageCategories,
          pageVerification: advertiser.pageVerification
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
      telegramId: { $exists: true, $nin: [null, ''] }
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
