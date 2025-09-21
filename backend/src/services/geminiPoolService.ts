import { GoogleGenerativeAI } from '@google/generative-ai';

interface GeminiRequest {
  prompt: string;
  priority: number;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

interface GeminiStats {
  activeRequests: number;
  completedRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  queueSize: number;
  rateLimitHits: number;
}

export class GeminiPoolService {
  private genAI: GoogleGenerativeAI | null = null;
  private activeRequests = 0;
  private maxConcurrentRequests: number;
  private requestQueue: GeminiRequest[] = [];
  private lastRequestTime = 0;
  private minRequestInterval = 1000; // 1 second between requests to avoid rate limits
  
  private stats: GeminiStats = {
    activeRequests: 0,
    completedRequests: 0,
    failedRequests: 0,
    avgResponseTime: 0,
    queueSize: 0,
    rateLimitHits: 0
  };

  private totalResponseTime = 0;

  constructor(maxConcurrentRequests = 10) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ GEMINI_API_KEY not found - AI analysis will fail');
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.maxConcurrentRequests = maxConcurrentRequests;

    console.log(`🤖 Gemini Pool Service initialized with max ${maxConcurrentRequests} concurrent requests`);
  }

  async analyzeContent(prompt: string, priority: number = 1): Promise<string> {
    if (!this.genAI) {
      throw new Error('Gemini AI not configured');
    }

    return new Promise((resolve, reject) => {
      const request: GeminiRequest = {
        prompt,
        priority,
        resolve,
        reject,
        timestamp: Date.now()
      };

      // Insert request in priority order
      let inserted = false;
      for (let i = 0; i < this.requestQueue.length; i++) {
        if (this.requestQueue[i] && this.requestQueue[i].priority < priority) {
          this.requestQueue.splice(i, 0, request);
          inserted = true;
          break;
        }
      }

      if (!inserted) {
        this.requestQueue.push(request);
      }

      this.stats.queueSize = this.requestQueue.length;
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.activeRequests >= this.maxConcurrentRequests || this.requestQueue.length === 0) {
      return;
    }

    // Rate limiting: ensure minimum interval between requests
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      setTimeout(() => this.processQueue(), this.minRequestInterval - timeSinceLastRequest);
      return;
    }

    const request = this.requestQueue.shift();
    if (!request) return;

    this.activeRequests++;
    this.lastRequestTime = Date.now();
    this.stats.activeRequests = this.activeRequests;
    this.stats.queueSize = this.requestQueue.length;

    const startTime = Date.now();

    try {
      const model = this.genAI!.getGenerativeModel({ 
        model: "gemini-1.5-flash-latest",
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.1, // Low temperature for consistent results
        }
      });

      const result = await model.generateContent(request.prompt);
      const response = await result.response;
      const text = response.text();

      const responseTime = Date.now() - startTime;
      this.updateStats(responseTime, true);

      request.resolve(text);

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateStats(responseTime, false);

      // Check if it's a rate limit error
      if (error instanceof Error && (
        error.message.includes('quota') || 
        error.message.includes('rate') ||
        error.message.includes('limit')
      )) {
        this.stats.rateLimitHits++;
        console.warn(`🚨 Gemini rate limit hit. Queue size: ${this.requestQueue.length}`);
        
        // Increase interval and retry
        this.minRequestInterval = Math.min(this.minRequestInterval * 1.5, 5000);
        
        // Re-queue the request with lower priority
        request.priority = Math.max(request.priority - 1, 1);
        this.requestQueue.unshift(request);
        this.stats.queueSize = this.requestQueue.length;
        
        // Wait before processing more
        setTimeout(() => this.processQueue(), 2000);
        return;
      }

      request.reject(error as Error);
    } finally {
      this.activeRequests--;
      this.stats.activeRequests = this.activeRequests;
      
      // Process next request
      setImmediate(() => this.processQueue());
    }
  }

  private updateStats(responseTime: number, success: boolean): void {
    if (success) {
      this.stats.completedRequests++;
      this.totalResponseTime += responseTime;
      this.stats.avgResponseTime = this.totalResponseTime / this.stats.completedRequests;
    } else {
      this.stats.failedRequests++;
    }
  }

  getStats(): GeminiStats {
    return { ...this.stats };
  }

  // Adjust rate limiting based on performance
  adjustRateLimit(newInterval: number): void {
    this.minRequestInterval = Math.max(newInterval, 100); // Minimum 100ms
    console.log(`🤖 Gemini rate limit adjusted to ${this.minRequestInterval}ms`);
  }

  // Clear old requests (older than 5 minutes)
  cleanupOldRequests(): void {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const initialLength = this.requestQueue.length;
    
    this.requestQueue = this.requestQueue.filter(req => {
      if (req.timestamp < fiveMinutesAgo) {
        req.reject(new Error('Request timeout - removed from queue'));
        return false;
      }
      return true;
    });

    const removed = initialLength - this.requestQueue.length;
    if (removed > 0) {
      console.log(`🧹 Cleaned up ${removed} old Gemini requests`);
      this.stats.queueSize = this.requestQueue.length;
    }
  }
}

// Global instance optimized for high concurrency
export const geminiPoolService = new GeminiPoolService(20); // 20 concurrent Gemini requests

// Cleanup old requests every 2 minutes
setInterval(() => {
  geminiPoolService.cleanupOldRequests();
}, 2 * 60 * 1000);
