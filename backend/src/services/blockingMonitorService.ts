import { collections } from './database.js';

export interface BlockingEvent {
  timestamp: Date;
  type: 'rate_limit' | 'ip_blocked' | 'captcha' | 'user_agent_blocked' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryAfter?: number;
  userAgent?: string;
  ipAddress?: string;
  pageId?: string;
  errorMessage?: string;
}

export interface BlockingStats {
  totalBlockings: number;
  blockingsByType: Record<string, number>;
  blockingsByHour: Record<number, number>;
  averageRetryAfter: number;
  lastBlocking: Date | null;
  currentSeverity: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: 'continue' | 'reduce_frequency' | 'pause' | 'change_strategy';
}

export class BlockingMonitorService {
  private blockingEvents: BlockingEvent[] = [];
  private readonly MAX_EVENTS_IN_MEMORY = 1000;
  private readonly ANALYSIS_WINDOW_HOURS = 24;

  /**
   * Record a blocking event
   */
  async recordBlockingEvent(event: Omit<BlockingEvent, 'timestamp'>): Promise<void> {
    const blockingEvent: BlockingEvent = {
      ...event,
      timestamp: new Date()
    };

    // Add to memory
    this.blockingEvents.push(blockingEvent);
    
    // Keep only recent events in memory
    if (this.blockingEvents.length > this.MAX_EVENTS_IN_MEMORY) {
      this.blockingEvents = this.blockingEvents.slice(-this.MAX_EVENTS_IN_MEMORY);
    }

    // Store in database for long-term analysis
    try {
      await collections.blockingEvents?.insertOne({
        ...blockingEvent,
        timestamp: blockingEvent.timestamp
      });
    } catch (error) {
      console.error('Failed to store blocking event:', error);
    }

    console.log(`🚫 Blocking event recorded: ${event.type} (${event.severity})`);
  }

  /**
   * Analyze blocking patterns and get recommendations
   */
  async analyzeBlockingPatterns(): Promise<BlockingStats> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - (this.ANALYSIS_WINDOW_HOURS * 60 * 60 * 1000));
    
    // Get events from database for analysis
    let recentEvents: BlockingEvent[] = [];
    
    try {
      const dbEvents = await collections.blockingEvents?.find({
        timestamp: { $gte: windowStart }
      }).toArray();
      
      if (dbEvents) {
        recentEvents = dbEvents.map(event => ({
          ...event,
          timestamp: new Date(event.timestamp)
        }));
      }
    } catch (error) {
      console.error('Failed to fetch blocking events from database:', error);
      // Fallback to memory events
      recentEvents = this.blockingEvents.filter(event => event.timestamp >= windowStart);
    }

    // Analyze patterns
    const totalBlockings = recentEvents.length;
    const blockingsByType: Record<string, number> = {};
    const blockingsByHour: Record<number, number> = {};
    let totalRetryAfter = 0;
    let retryAfterCount = 0;
    let lastBlocking: Date | null = null;

    recentEvents.forEach(event => {
      // Count by type
      blockingsByType[event.type] = (blockingsByType[event.type] || 0) + 1;
      
      // Count by hour
      const hour = event.timestamp.getHours();
      blockingsByHour[hour] = (blockingsByHour[hour] || 0) + 1;
      
      // Track retry after times
      if (event.retryAfter) {
        totalRetryAfter += event.retryAfter;
        retryAfterCount++;
      }
      
      // Track last blocking
      if (!lastBlocking || event.timestamp > lastBlocking) {
        lastBlocking = event.timestamp;
      }
    });

    const averageRetryAfter = retryAfterCount > 0 ? totalRetryAfter / retryAfterCount : 0;
    
    // Determine current severity and recommended action
    const { currentSeverity, recommendedAction } = this.calculateSeverityAndAction(
      totalBlockings,
      blockingsByType,
      recentEvents
    );

    return {
      totalBlockings,
      blockingsByType,
      blockingsByHour,
      averageRetryAfter,
      lastBlocking,
      currentSeverity,
      recommendedAction
    };
  }

  /**
   * Calculate severity and recommended action based on blocking patterns
   */
  private calculateSeverityAndAction(
    totalBlockings: number,
    blockingsByType: Record<string, number>,
    recentEvents: BlockingEvent[]
  ): { currentSeverity: 'low' | 'medium' | 'high' | 'critical', recommendedAction: 'continue' | 'reduce_frequency' | 'pause' | 'change_strategy' } {
    
    // Calculate severity based on frequency and types
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let recommendedAction: 'continue' | 'reduce_frequency' | 'pause' | 'change_strategy' = 'continue';

    // High frequency blocking
    if (totalBlockings > 50) {
      severity = 'critical';
      recommendedAction = 'pause';
    } else if (totalBlockings > 20) {
      severity = 'high';
      recommendedAction = 'reduce_frequency';
    } else if (totalBlockings > 10) {
      severity = 'medium';
      recommendedAction = 'reduce_frequency';
    }

    // Check for specific blocking types
    if (blockingsByType['ip_blocked'] > 5) {
      severity = 'critical';
      recommendedAction = 'change_strategy';
    } else if (blockingsByType['captcha'] > 10) {
      severity = 'high';
      recommendedAction = 'change_strategy';
    } else if (blockingsByType['rate_limit'] > 20) {
      severity = 'high';
      recommendedAction = 'reduce_frequency';
    }

    // Check for recent escalation
    const lastHour = recentEvents.filter(event => 
      event.timestamp > new Date(Date.now() - 60 * 60 * 1000)
    ).length;
    
    if (lastHour > 10) {
      severity = 'critical';
      recommendedAction = 'pause';
    }

    return { currentSeverity: severity, recommendedAction };
  }

  /**
   * Get recommended delay based on current blocking patterns
   */
  async getRecommendedDelay(): Promise<number> {
    const stats = await this.analyzeBlockingPatterns();
    
    // Base delay
    let baseDelay = 2000; // 2 seconds
    
    // Adjust based on severity
    switch (stats.currentSeverity) {
      case 'critical':
        baseDelay = 300000; // 5 minutes
        break;
      case 'high':
        baseDelay = 60000; // 1 minute
        break;
      case 'medium':
        baseDelay = 10000; // 10 seconds
        break;
      case 'low':
        baseDelay = 2000; // 2 seconds
        break;
    }
    
    // Add jitter
    const jitter = Math.random() * baseDelay * 0.5;
    
    return Math.floor(baseDelay + jitter);
  }

  /**
   * Get recommended batch size based on blocking patterns
   */
  async getRecommendedBatchSize(): Promise<number> {
    const stats = await this.analyzeBlockingPatterns();
    
    // Base batch size
    let batchSize = 50;
    
    // Adjust based on severity
    switch (stats.currentSeverity) {
      case 'critical':
        batchSize = 5; // Very small batches
        break;
      case 'high':
        batchSize = 10; // Small batches
        break;
      case 'medium':
        batchSize = 25; // Medium batches
        break;
      case 'low':
        batchSize = 50; // Normal batches
        break;
    }
    
    return batchSize;
  }

  /**
   * Get recommended concurrency based on blocking patterns
   */
  async getRecommendedConcurrency(): Promise<number> {
    const stats = await this.analyzeBlockingPatterns();
    
    // Base concurrency
    let concurrency = 10;
    
    // Adjust based on severity
    switch (stats.currentSeverity) {
      case 'critical':
        concurrency = 1; // Single request at a time
        break;
      case 'high':
        concurrency = 2; // Very low concurrency
        break;
      case 'medium':
        concurrency = 5; // Low concurrency
        break;
      case 'low':
        concurrency = 10; // Normal concurrency
        break;
    }
    
    return concurrency;
  }

  /**
   * Get blocking statistics for monitoring dashboard
   */
  async getBlockingStats(): Promise<BlockingStats> {
    return this.analyzeBlockingPatterns();
  }

  /**
   * Clear old blocking events (cleanup)
   */
  async cleanupOldEvents(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
    
    try {
      await collections.blockingEvents?.deleteMany({
        timestamp: { $lt: cutoffDate }
      });
      console.log(`🧹 Cleaned up blocking events older than ${daysToKeep} days`);
    } catch (error) {
      console.error('Failed to cleanup old blocking events:', error);
    }
  }
}

// Singleton instance
export const blockingMonitorService = new BlockingMonitorService();
