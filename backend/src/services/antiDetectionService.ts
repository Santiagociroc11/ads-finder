import fetch from 'node-fetch';
import { randomBytes } from 'crypto';
import { blockingMonitorService } from './blockingMonitorService.js';

export interface ScrapingConfig {
  userAgent: string;
  headers: Record<string, string>;
  delay: number;
  retryDelay: number;
  maxRetries: number;
  proxy?: string;
}

export interface BlockingDetection {
  isBlocked: boolean;
  reason: 'rate_limit' | 'captcha' | 'ip_blocked' | 'user_agent_blocked' | 'unknown';
  retryAfter?: number; // seconds
  suggestedDelay?: number; // milliseconds
}

export class AntiDetectionService {
  private userAgents: string[] = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
  ];

  private currentUserAgentIndex = 0;
  private lastRequestTime = 0;
  private consecutiveFailures = 0;
  private isCircuitOpen = false;
  private circuitOpenUntil = 0;

  /**
   * Get a random scraping configuration
   */
  getScrapingConfig(): ScrapingConfig {
    const userAgent = this.getRandomUserAgent();
    const delay = this.calculateDelay();
    
    return {
      userAgent,
      headers: this.generateHeaders(userAgent),
      delay,
      retryDelay: this.calculateRetryDelay(),
      maxRetries: 3
    };
  }

  /**
   * Make a request with anti-detection measures
   */
  async makeRequest(url: string, options: RequestInit = {}): Promise<{
    success: boolean;
    data?: string;
    error?: string;
    blockingDetection?: BlockingDetection;
  }> {
    // Check circuit breaker
    if (this.isCircuitOpen && Date.now() < this.circuitOpenUntil) {
      return {
        success: false,
        error: 'Circuit breaker is open',
        blockingDetection: {
          isBlocked: true,
          reason: 'rate_limit',
          retryAfter: Math.ceil((this.circuitOpenUntil - Date.now()) / 1000)
        }
      };
    }

    const config = this.getScrapingConfig();
    
    // Apply delay
    await this.applyDelay();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const fetchOptions: any = {
        method: options.method || 'GET',
        headers: {
          ...config.headers,
          ...(options.headers as Record<string, string>)
        },
        signal: controller.signal
      };

      if (options.body) {
        fetchOptions.body = options.body;
      }

      const response = await fetch(url, fetchOptions);

      clearTimeout(timeoutId);

      // Detect blocking
      const blockingDetection = this.detectBlocking(response);
      
      if (blockingDetection.isBlocked) {
        await this.handleBlocking(blockingDetection);
        return {
          success: false,
          error: `Blocked: ${blockingDetection.reason}`,
          blockingDetection
        };
      }

      // Reset failure counter on success
      this.consecutiveFailures = 0;
      this.isCircuitOpen = false;

      const data = await response.text();
      return {
        success: true,
        data
      };

    } catch (error) {
      this.consecutiveFailures++;
      
      // Open circuit breaker after too many failures
      if (this.consecutiveFailures >= 5) {
        this.openCircuitBreaker(300000); // 5 minutes
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Detect if we're being blocked
   */
  private detectBlocking(response: any): BlockingDetection {
    const status = response.status;
    const headers = response.headers;
    const contentType = headers.get('content-type') || '';

    // Rate limiting
    if (status === 429) {
      const retryAfter = parseInt(headers.get('retry-after') || '60');
      return {
        isBlocked: true,
        reason: 'rate_limit',
        retryAfter,
        suggestedDelay: retryAfter * 1000
      };
    }

    // IP blocked
    if (status === 403 || status === 451) {
      return {
        isBlocked: true,
        reason: 'ip_blocked',
        suggestedDelay: 300000 // 5 minutes
      };
    }

    // Check for CAPTCHA or blocking page
    if (contentType.includes('text/html')) {
      // This would need to be implemented with actual HTML parsing
      // For now, we'll use a simple heuristic
      if (status === 200 && response.url.includes('checkpoint')) {
        return {
          isBlocked: true,
          reason: 'captcha',
          suggestedDelay: 600000 // 10 minutes
        };
      }
    }

    return {
      isBlocked: false,
      reason: 'unknown'
    };
  }

  /**
   * Handle blocking detection
   */
  private async handleBlocking(detection: BlockingDetection): Promise<void> {
    console.warn(`🚫 Blocking detected: ${detection.reason}`);
    
    // Record blocking event for analysis
    await blockingMonitorService.recordBlockingEvent({
      type: detection.reason,
      severity: this.getSeverityFromReason(detection.reason),
      retryAfter: detection.retryAfter,
      userAgent: this.userAgents[this.currentUserAgentIndex],
      errorMessage: `Blocked: ${detection.reason}`
    });
    
    if (detection.suggestedDelay) {
      this.openCircuitBreaker(detection.suggestedDelay);
    }

    // Rotate user agent
    this.rotateUserAgent();
  }

  /**
   * Get severity level from blocking reason
   */
  private getSeverityFromReason(reason: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (reason) {
      case 'rate_limit':
        return 'medium';
      case 'captcha':
        return 'high';
      case 'ip_blocked':
        return 'critical';
      case 'user_agent_blocked':
        return 'medium';
      default:
        return 'low';
    }
  }

  /**
   * Open circuit breaker
   */
  private openCircuitBreaker(duration: number): void {
    this.isCircuitOpen = true;
    this.circuitOpenUntil = Date.now() + duration;
    console.warn(`🔴 Circuit breaker opened for ${duration / 1000} seconds`);
  }

  /**
   * Get random user agent
   */
  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * Rotate to next user agent
   */
  private rotateUserAgent(): void {
    this.currentUserAgentIndex = (this.currentUserAgentIndex + 1) % this.userAgents.length;
    console.log(`🔄 Rotated to user agent ${this.currentUserAgentIndex + 1}`);
  }

  /**
   * Generate realistic headers
   */
  private generateHeaders(userAgent: string): Record<string, string> {
    const acceptLanguages = [
      'en-US,en;q=0.9',
      'en-US,en;q=0.9,es;q=0.8',
      'en-GB,en;q=0.9,en-US;q=0.8',
      'es-ES,es;q=0.9,en;q=0.8'
    ];

    return {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)],
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"'
    };
  }

  /**
   * Calculate delay based on current state
   */
  private calculateDelay(): number {
    const baseDelay = 2000; // 2 seconds base
    const failureMultiplier = Math.min(this.consecutiveFailures * 1000, 10000); // Max 10 seconds
    const randomJitter = Math.random() * 1000; // 0-1 second random
    
    return baseDelay + failureMultiplier + randomJitter;
  }

  /**
   * Calculate retry delay
   */
  private calculateRetryDelay(): number {
    return 5000 + (Math.random() * 5000); // 5-10 seconds
  }

  /**
   * Apply delay with jitter
   */
  private async applyDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const config = this.getScrapingConfig();
    
    if (timeSinceLastRequest < config.delay) {
      const remainingDelay = config.delay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, remainingDelay));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Get current status
   */
  getStatus(): {
    isCircuitOpen: boolean;
    circuitOpenUntil: number;
    consecutiveFailures: number;
    currentUserAgent: string;
  } {
    return {
      isCircuitOpen: this.isCircuitOpen,
      circuitOpenUntil: this.circuitOpenUntil,
      consecutiveFailures: this.consecutiveFailures,
      currentUserAgent: this.userAgents[this.currentUserAgentIndex]
    };
  }

  /**
   * Reset the service state
   */
  reset(): void {
    this.consecutiveFailures = 0;
    this.isCircuitOpen = false;
    this.circuitOpenUntil = 0;
    this.lastRequestTime = 0;
    console.log('🔄 Anti-detection service reset');
  }
}

// Singleton instance
export const antiDetectionService = new AntiDetectionService();
