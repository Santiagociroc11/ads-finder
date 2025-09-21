import fetch from 'node-fetch';
import { Agent } from 'https';

interface RequestOptions {
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

interface PoolStats {
  activeRequests: number;
  completedRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  queueSize: number;
}

export class HttpPoolService {
  private activeRequests = 0;
  private maxConcurrentRequests: number;
  private requestQueue: Array<{
    options: RequestOptions;
    resolve: (value: string) => void;
    reject: (error: Error) => void;
  }> = [];
  
  private stats: PoolStats = {
    activeRequests: 0,
    completedRequests: 0,
    failedRequests: 0,
    avgResponseTime: 0,
    queueSize: 0
  };

  private totalResponseTime = 0;
  private agent: Agent;

  constructor(maxConcurrentRequests = 50) {
    this.maxConcurrentRequests = maxConcurrentRequests;
    
    // Create HTTP agent with connection pooling
    this.agent = new Agent({
      keepAlive: true,
      maxSockets: maxConcurrentRequests,
      maxFreeSockets: 10,
      timeout: 30000,
      freeSocketTimeout: 4000,
      keepAliveMsecs: 1000
    });

    console.log(`🌐 HTTP Pool Service initialized with max ${maxConcurrentRequests} concurrent requests`);
  }

  async fetchHtml(options: RequestOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ options, resolve, reject });
      this.stats.queueSize = this.requestQueue.length;
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.activeRequests >= this.maxConcurrentRequests || this.requestQueue.length === 0) {
      return;
    }

    const queueItem = this.requestQueue.shift();
    if (!queueItem) return;

    this.activeRequests++;
    this.stats.activeRequests = this.activeRequests;
    this.stats.queueSize = this.requestQueue.length;

    const startTime = Date.now();

    try {
      const html = await this.executeRequest(queueItem.options);
      
      const responseTime = Date.now() - startTime;
      this.updateStats(responseTime, true);
      
      queueItem.resolve(html);
    } catch (error) {
      this.updateStats(Date.now() - startTime, false);
      queueItem.reject(error as Error);
    } finally {
      this.activeRequests--;
      this.stats.activeRequests = this.activeRequests;
      
      // Process next item in queue
      setImmediate(() => this.processQueue());
    }
  }

  private async executeRequest(options: RequestOptions): Promise<string> {
    const { url, headers = {}, timeout = 30000, retries = 3 } = options;
    
    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'max-age=0',
      ...headers
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: defaultHeaders,
          timeout,
          agent: this.agent,
          compress: true
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        return html;

      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retries) {
          // Exponential backoff: 500ms, 1s, 2s
          const delay = Math.min(500 * Math.pow(2, attempt - 1), 2000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Failed to fetch after all retries');
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

  getStats(): PoolStats {
    return { ...this.stats };
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log(`🌐 Shutting down HTTP pool (${this.activeRequests} active, ${this.requestQueue.length} queued)`);
    
    // Wait for active requests to complete (max 30 seconds)
    const maxWaitTime = 30000;
    const startTime = Date.now();
    
    while (this.activeRequests > 0 && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.agent.destroy();
    console.log('🌐 HTTP pool shutdown complete');
  }
}

// Global instance with optimized settings for 1000 users
export const httpPoolService = new HttpPoolService(100); // 100 concurrent requests max

// Graceful shutdown
process.on('SIGTERM', async () => {
  await httpPoolService.shutdown();
});

process.on('SIGINT', async () => {
  await httpPoolService.shutdown();
});
