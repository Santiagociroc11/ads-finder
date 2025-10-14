interface QueueJob {
  id: string;
  type: 'advertiser-stats' | 'scraping';
  data: any;
  priority: number;
  retries: number;
  maxRetries: number;
  createdAt: Date;
  userId?: string; // Track jobs by user
  cancelled?: boolean; // Cancellation flag
  abortController?: AbortController; // For cancelling HTTP requests
  resolve: (result: any) => void;
  reject: (error: any) => void;
}

export class SimpleQueue {
  private queue: QueueJob[] = [];
  private processing: boolean = false;
  private concurrency: number;
  private activeJobs: number = 0;

  constructor(concurrency: number = 3) {
    this.concurrency = concurrency;
    console.log(`🔄 Simple queue initialized with concurrency: ${concurrency}`);
  }

  async add<T>(
    type: 'advertiser-stats' | 'scraping',
    data: any,
    priority: number = 1,
    maxRetries: number = 2,
    userId?: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const job: QueueJob = {
        id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        data,
        priority,
        retries: 0,
        maxRetries,
        createdAt: new Date(),
        userId: userId || 'anonymous',
        cancelled: false,
        abortController: new AbortController(), // Create AbortController for each job
        resolve,
        reject
      };

      // Insert job in priority order
      let inserted = false;
      for (let i = 0; i < this.queue.length; i++) {
        if (this.queue[i] && this.queue[i].priority < priority) {
          this.queue.splice(i, 0, job);
          inserted = true;
          break;
        }
      }
      
      if (!inserted) {
        this.queue.push(job);
      }

      console.log(`🔄 Job added to queue: ${job.id} (${this.queue.length} in queue, ${this.activeJobs} active)`);
      
      // Start processing if not already processing
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.activeJobs >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.activeJobs < this.concurrency) {
      const job = this.queue.shift();
      if (!job) break;

      this.activeJobs++;
      console.log(`🔄 Processing job: ${job.id} (${this.activeJobs}/${this.concurrency} active)`);

      // Process job in background
      this.processJob(job).finally(() => {
        this.activeJobs--;
        // Continue processing queue
        setImmediate(() => this.processQueue());
      });
    }

    this.processing = false;
  }

  private async processJob(job: QueueJob): Promise<void> {
    try {
      // Check if job was cancelled before processing
      if (job.cancelled) {
        console.log(`🚫 Job was cancelled: ${job.id}`);
        job.reject(new Error('Job was cancelled'));
        return;
      }

      let result: any;

      switch (job.type) {
        case 'advertiser-stats':
          result = await this.processAdvertiserStats(job.data, job.abortController);
          break;
        case 'scraping':
          result = await this.processScraping(job.data, job.abortController);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      // Check again if job was cancelled during processing
      if (job.cancelled) {
        console.log(`🚫 Job was cancelled during processing: ${job.id}`);
        job.reject(new Error('Job was cancelled during processing'));
        return;
      }

      console.log(`✅ Job completed: ${job.id}`);
      job.resolve(result);

    } catch (error) {
      console.error(`❌ Job failed: ${job.id}`, error);

      if (job.retries < job.maxRetries) {
        job.retries++;
        console.log(`🔄 Retrying job: ${job.id} (attempt ${job.retries}/${job.maxRetries})`);
        
        // Add back to queue with lower priority
        job.priority = Math.max(1, job.priority - 1);
        this.queue.unshift(job);
        
        return;
      }

      job.reject(error);
    }
  }

  private async processAdvertiserStats(data: { pageId: string; country: string; userId?: string }, abortController?: AbortController): Promise<any> {
    const { AdvertiserStatsService } = await import('./advertiserStatsService.js');
    const statsService = new AdvertiserStatsService();
    
    console.log(`[QUEUE_WORKER] Processing 'advertiser-stats' for pageId: ${data.pageId}, userId: ${data.userId}`);

    // Retry logic for timeouts
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`🔄 Retry attempt ${attempt} for pageId: ${data.pageId}`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay before retry
        }
        
        const result = await statsService.getAdvertiserStats(data.pageId, data.country, data.userId);
        if (attempt > 1) {
          console.log(`✅ Retry successful for pageId: ${data.pageId}`);
        }
        return result;
      } catch (error: any) {
        lastError = error;
        
        // Only retry on timeout errors
        if (error.name === 'TimeoutError' && attempt < 2) {
          console.log(`⏰ Timeout on attempt ${attempt} for pageId: ${data.pageId}, retrying...`);
          continue;
        }
        
        // For other errors or final attempt, throw immediately
        throw error;
      }
    }
    
    throw lastError;
  }

  private async processScraping(data: any, abortController?: AbortController): Promise<any> {
    // Placeholder for scraping jobs
    throw new Error('Scraping jobs not implemented yet');
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      activeJobs: this.activeJobs,
      concurrency: this.concurrency,
      processing: this.processing
    };
  }

  // Cancel all pending jobs for a specific user
  cancelUserJobs(userId: string): number {
    let cancelledCount = 0;
    
    console.log(`🚫 BEFORE Cancel - Queue size: ${this.queue.length}, Active jobs: ${this.activeJobs}`);
    
    // Cancel ALL jobs for this user (pending AND active)
    this.queue.forEach(job => {
      if (job.userId === userId && !job.cancelled) {
        job.cancelled = true;
        
        // Abort any ongoing HTTP request
        if (job.abortController) {
          job.abortController.abort();
          console.log(`🚫 Aborted HTTP request for job: ${job.id}`);
        }
        
        job.reject(new Error('Job cancelled due to new search'));
        cancelledCount++;
      }
    });
    
    // Remove ALL cancelled jobs from queue
    this.queue = this.queue.filter(job => job.userId !== userId);
    
    console.log(`🚫 AFTER Cancel - Cancelled: ${cancelledCount}, Queue size: ${this.queue.length}, Active jobs: ${this.activeJobs}`);
    return cancelledCount;
  }

  // Get pending jobs count for a user
  getUserPendingJobs(userId: string): number {
    return this.queue.filter(job => job.userId === userId && !job.cancelled).length;
  }

  clear() {
    // Reject all pending jobs
    this.queue.forEach(job => {
      job.reject(new Error('Queue cleared'));
    });
    
    this.queue = [];
    console.log('🔄 Queue cleared');
  }
}

// Global queue instance
export const advertiserStatsQueue = new SimpleQueue(2); // Max 2 concurrent stats jobs
