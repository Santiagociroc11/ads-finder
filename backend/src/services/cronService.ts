import { dailyAdvertiserMonitor } from './dailyAdvertiserMonitor.js';
import { smartScheduler } from './smartScheduler.js';
import { cronQueueService } from './cronQueue.js';

export class CronService {
  private dailyMonitorInterval: NodeJS.Timeout | null = null;
  private isStarted = false;

  /**
   * Inicia todos los cron jobs
   */
  start(): void {
    if (this.isStarted) {
      console.log('⏰ Cron service already started');
      return;
    }

    console.log('⏰ Starting cron service...');
    
    // Monitoreo diario de anunciantes (cada 24 horas a las 6:00 AM)
    this.startDailyAdvertiserMonitoring();
    
    this.isStarted = true;
    console.log('✅ Cron service started successfully');
  }

  /**
   * Detiene todos los cron jobs
   */
  stop(): void {
    if (!this.isStarted) {
      return;
    }

    console.log('⏹️ Stopping cron service...');

    if (this.dailyMonitorInterval) {
      clearInterval(this.dailyMonitorInterval);
      this.dailyMonitorInterval = null;
    }

    this.isStarted = false;
    console.log('✅ Cron service stopped');
  }

  /**
   * Inicia el monitoreo diario de anunciantes con programación inteligente
   */
  private startDailyAdvertiserMonitoring(): void {
    console.log('📊 Starting smart daily advertiser monitoring...');
    
    // Wait 30 seconds after server start to ensure database is ready
    setTimeout(async () => {
      try {
        // Create daily schedule
        await smartScheduler.scheduleAdvertisersForDay();
        
        // Start processing batches every 2 hours
        this.startBatchProcessing();
        
        console.log('✅ Smart daily monitoring started successfully');
      } catch (error) {
        console.error('❌ Error starting smart daily monitoring:', error);
      }
    }, 30000); // Wait 30 seconds for database initialization
  }

  /**
   * Start processing batches every 2 hours
   */
  private startBatchProcessing(): void {
    // Process immediately if there's a batch ready
    this.processNextBatch();
    
    // Then process every 2 hours
    this.dailyMonitorInterval = setInterval(() => {
      this.processNextBatch();
    }, 2 * 60 * 60 * 1000); // 2 hours in milliseconds
  }

  /**
   * Process the next scheduled batch
   */
  private async processNextBatch(): Promise<void> {
    try {
      const nextBatch = await smartScheduler.getNextBatch();
      
      if (!nextBatch) {
        console.log('📊 No batches ready for processing');
        return;
      }

      console.log(`📊 Processing batch ${nextBatch.batchId} with ${nextBatch.advertiserIds.length} advertisers`);
      
      // Get advertisers for this batch
      const advertisers = await this.getAdvertisersForBatch(nextBatch.advertiserIds);
      
      if (advertisers.length === 0) {
        console.log('📊 No advertisers found for batch, marking as processed');
        await smartScheduler.markBatchProcessed(nextBatch.batchId);
        return;
      }

      // Process batch using optimized queue
      await cronQueueService.addAdvertisersToQueue(advertisers);
      const results = await cronQueueService.processQueue();
      
      // Mark batch as processed
      await smartScheduler.markBatchProcessed(nextBatch.batchId);
      
      console.log(`✅ Batch ${nextBatch.batchId} processed: ${results.length} advertisers`);
      
    } catch (error) {
      console.error('❌ Error processing batch:', error);
    }
  }

  /**
   * Get advertisers for a specific batch
   */
  private async getAdvertisersForBatch(advertiserIds: string[]): Promise<any[]> {
    const { collections } = await import('@/services/database.js');
    const { ObjectId } = await import('mongodb');
    
    if (!collections.trackedAdvertisers) {
      return [];
    }

    const objectIds = advertiserIds.map(id => new ObjectId(id));
    
    return await collections.trackedAdvertisers
      .find({ 
        _id: { $in: objectIds },
        isActive: true 
      })
      .toArray();
  }

  /**
   * Ejecuta el monitoreo diario
   */
  private async runDailyMonitoring(): Promise<void> {
    try {
      console.log('🚀 Executing scheduled daily advertiser monitoring...');
      await dailyAdvertiserMonitor.runDailyMonitoring();
    } catch (error) {
      console.error('❌ Error in scheduled daily monitoring:', error);
    }
  }

  /**
   * Ejecuta el monitoreo manualmente (para testing)
   */
  async runDailyMonitoringNow(): Promise<void> {
    console.log('🔧 Running daily monitoring manually...');
    await dailyAdvertiserMonitor.runDailyMonitoring();
  }

  /**
   * Obtiene el estado del cron service
   */
  getStatus(): {
    isStarted: boolean;
    nextDailyMonitoring: Date | null;
    monitoringStatus: any;
  } {
    const monitoringStatus = dailyAdvertiserMonitor.getStatus();
    
    return {
      isStarted: this.isStarted,
      nextDailyMonitoring: this.dailyMonitorInterval ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
      monitoringStatus
    };
  }
}

// Singleton instance
export const cronService = new CronService();
