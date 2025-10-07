import { collections } from '@/services/database.js';
import { ObjectId } from 'mongodb';

interface ScheduledBatch {
  batchId: string;
  advertiserIds: string[];
  scheduledTime: Date;
  priority: number;
  estimatedDuration: number; // in minutes
}

export class SmartScheduler {
  private readonly MAX_DAILY_BATCHES = 12; // 12 batches per day (every 2 hours)
  private readonly BATCH_SIZE = 50; // 50 advertisers per batch
  private readonly MIN_BATCH_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

  /**
   * Schedule advertisers for processing throughout the day
   */
  async scheduleAdvertisersForDay(): Promise<ScheduledBatch[]> {
    console.log('📅 Creating smart schedule for daily advertiser processing...');
    
    // Get all active tracked advertisers
    const advertisers = await this.getActiveAdvertisers();
    console.log(`📅 Found ${advertisers.length} active advertisers to schedule`);
    
    if (advertisers.length === 0) {
      return [];
    }

    // Create batches
    const batches = this.createBatches(advertisers);
    console.log(`📅 Created ${batches.length} batches`);
    
    // Schedule batches throughout the day
    const scheduledBatches = this.scheduleBatches(batches);
    console.log(`📅 Scheduled ${scheduledBatches.length} batches throughout the day`);
    
    // Store schedule in database
    await this.storeSchedule(scheduledBatches);
    
    return scheduledBatches;
  }

  /**
   * Get the next batch to process
   */
  async getNextBatch(): Promise<ScheduledBatch | null> {
    const now = new Date();
    
    const nextBatch = await collections.scheduledBatches?.findOne({
      scheduledTime: { $lte: now },
      processed: { $ne: true }
    }, {
      sort: { scheduledTime: 1 }
    });

    return nextBatch || null;
  }

  /**
   * Mark a batch as processed
   */
  async markBatchProcessed(batchId: string): Promise<void> {
    await collections.scheduledBatches?.updateOne(
      { batchId },
      { $set: { processed: true, processedAt: new Date() } }
    );
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    totalBatches: number;
    processedBatches: number;
    remainingBatches: number;
    nextBatchTime: Date | null;
    estimatedCompletionTime: Date | null;
  }> {
    const totalBatches = await collections.scheduledBatches?.countDocuments({}) || 0;
    const processedBatches = await collections.scheduledBatches?.countDocuments({ processed: true }) || 0;
    const remainingBatches = totalBatches - processedBatches;
    
    const nextBatch = await collections.scheduledBatches?.findOne({
      processed: { $ne: true }
    }, {
      sort: { scheduledTime: 1 }
    });
    
    const lastBatch = await collections.scheduledBatches?.findOne({
      processed: { $ne: true }
    }, {
      sort: { scheduledTime: -1 }
    });
    
    return {
      totalBatches,
      processedBatches,
      remainingBatches,
      nextBatchTime: nextBatch?.scheduledTime || null,
      estimatedCompletionTime: lastBatch?.scheduledTime || null
    };
  }

  /**
   * Get active tracked advertisers
   */
  private async getActiveAdvertisers(): Promise<any[]> {
    if (!collections.trackedAdvertisers) {
      return [];
    }

    return await collections.trackedAdvertisers
      .find({ isActive: true })
      .toArray();
  }

  /**
   * Create batches from advertisers
   */
  private createBatches(advertisers: any[]): any[][] {
    const batches: any[][] = [];
    
    for (let i = 0; i < advertisers.length; i += this.BATCH_SIZE) {
      batches.push(advertisers.slice(i, i + this.BATCH_SIZE));
    }
    
    return batches;
  }

  /**
   * Schedule batches throughout the day
   */
  private scheduleBatches(batches: any[][]): ScheduledBatch[] {
    const scheduledBatches: ScheduledBatch[] = [];
    const now = new Date();
    
    // Start scheduling from 6:00 AM
    const startTime = new Date(now);
    startTime.setHours(6, 0, 0, 0);
    
    // If it's already past 6 AM today, start from tomorrow
    if (now >= startTime) {
      startTime.setDate(startTime.getDate() + 1);
    }
    
    batches.forEach((batch, index) => {
      const scheduledTime = new Date(startTime);
      scheduledTime.setMinutes(scheduledTime.getMinutes() + (index * 120)); // 2 hours apart
      
      const scheduledBatch: ScheduledBatch = {
        batchId: `batch-${Date.now()}-${index}`,
        advertiserIds: batch.map(ad => ad._id.toString()),
        scheduledTime,
        priority: index + 1,
        estimatedDuration: Math.ceil(batch.length / 10) // Estimate based on batch size
      };
      
      scheduledBatches.push(scheduledBatch);
    });
    
    return scheduledBatches;
  }

  /**
   * Store schedule in database
   */
  private async storeSchedule(scheduledBatches: ScheduledBatch[]): Promise<void> {
    if (!collections.scheduledBatches) {
      console.error('❌ scheduledBatches collection not available');
      return;
    }

    // Clear existing schedule for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    await collections.scheduledBatches.deleteMany({
      scheduledTime: { $gte: today, $lt: tomorrow }
    });

    // Insert new schedule
    const documents = scheduledBatches.map(batch => ({
      ...batch,
      createdAt: new Date(),
      processed: false
    }));

    await collections.scheduledBatches.insertMany(documents);
    console.log(`📅 Stored ${documents.length} scheduled batches in database`);
  }

  /**
   * Get current schedule status
   */
  async getScheduleStatus(): Promise<{
    today: ScheduledBatch[];
    tomorrow: ScheduledBatch[];
    nextBatch: ScheduledBatch | null;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const [todayBatches, tomorrowBatches, nextBatch] = await Promise.all([
      collections.scheduledBatches?.find({
        scheduledTime: { $gte: today, $lt: tomorrow }
      }).toArray() || [],
      collections.scheduledBatches?.find({
        scheduledTime: { $gte: tomorrow, $lt: dayAfter }
      }).toArray() || [],
      this.getNextBatch()
    ]);

    return {
      today: todayBatches as ScheduledBatch[],
      tomorrow: tomorrowBatches as ScheduledBatch[],
      nextBatch
    };
  }
}

// Singleton instance
export const smartScheduler = new SmartScheduler();
