import { Request, Response, NextFunction } from 'express';

interface ConcurrencyMetrics {
  activeRequests: number;
  peakConcurrency: number;
  totalRequests: number;
  avgResponseTime: number;
  errorRate: number;
  lastResetTime: number;
  requestsPerSecond: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  systemLoad: {
    cpu: number;
    connections: number;
  };
}

class ConcurrencyMonitor {
  private metrics: ConcurrencyMetrics = {
    activeRequests: 0,
    peakConcurrency: 0,
    totalRequests: 0,
    avgResponseTime: 0,
    errorRate: 0,
    lastResetTime: Date.now(),
    requestsPerSecond: 0,
    memoryUsage: { used: 0, total: 0, percentage: 0 },
    systemLoad: { cpu: 0, connections: 0 }
  };

  private requestTimes: number[] = [];
  private errors: number = 0;
  private requestTimestamps: number[] = [];

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      this.metrics.activeRequests++;
      this.metrics.totalRequests++;
      this.requestTimestamps.push(startTime);

      // Update peak concurrency
      if (this.metrics.activeRequests > this.metrics.peakConcurrency) {
        this.metrics.peakConcurrency = this.metrics.activeRequests;
      }

      // Monitor response
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any): Response {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        // Update metrics
        monitor.metrics.activeRequests--;
        monitor.requestTimes.push(responseTime);

        // Track errors
        if (res.statusCode >= 400) {
          monitor.errors++;
        }

        // Update averages (keep only last 1000 requests for performance)
        if (monitor.requestTimes.length > 1000) {
          monitor.requestTimes = monitor.requestTimes.slice(-500);
        }

        monitor.updateAverages();
        
        return originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  private updateAverages(): void {
    // Average response time
    if (this.requestTimes.length > 0) {
      const sum = this.requestTimes.reduce((a, b) => a + b, 0);
      this.metrics.avgResponseTime = sum / this.requestTimes.length;
    }

    // Error rate
    this.metrics.errorRate = (this.errors / this.metrics.totalRequests) * 100;

    // Requests per second (last minute)
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.requestTimestamps.filter(time => time > oneMinuteAgo);
    this.metrics.requestsPerSecond = recentRequests.length / 60;

    // Clean old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(time => time > oneMinuteAgo);

    // Memory usage
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = {
      used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    };
  }

  getMetrics(): ConcurrencyMetrics {
    this.updateAverages();
    return { ...this.metrics };
  }

  getDetailedReport() {
    const metrics = this.getMetrics();
    const uptime = Date.now() - metrics.lastResetTime;

    return {
      summary: {
        status: this.getSystemStatus(metrics),
        uptime: `${Math.round(uptime / 1000 / 60)} minutes`,
        health: this.getHealthScore(metrics)
      },
      performance: {
        concurrent: `${metrics.activeRequests}/${metrics.peakConcurrency} peak`,
        rps: `${metrics.requestsPerSecond.toFixed(1)}/sec`,
        avgResponse: `${metrics.avgResponseTime.toFixed(0)}ms`,
        errorRate: `${metrics.errorRate.toFixed(2)}%`
      },
      resources: {
        memory: `${metrics.memoryUsage.used}MB (${metrics.memoryUsage.percentage}%)`,
        cpu: 'Real-time monitoring needed',
        connections: metrics.activeRequests
      },
      recommendations: this.getRecommendations(metrics)
    };
  }

  private getSystemStatus(metrics: ConcurrencyMetrics): string {
    if (metrics.activeRequests > 500) return 'OVERLOADED';
    if (metrics.avgResponseTime > 5000) return 'SLOW';
    if (metrics.errorRate > 10) return 'ERRORS';
    if (metrics.memoryUsage.percentage > 85) return 'HIGH_MEMORY';
    if (metrics.activeRequests > 100) return 'BUSY';
    return 'HEALTHY';
  }

  private getHealthScore(metrics: ConcurrencyMetrics): number {
    let score = 100;
    
    // Response time penalty
    if (metrics.avgResponseTime > 1000) score -= 20;
    if (metrics.avgResponseTime > 3000) score -= 30;
    
    // Error rate penalty
    if (metrics.errorRate > 5) score -= 25;
    if (metrics.errorRate > 15) score -= 50;
    
    // Memory penalty
    if (metrics.memoryUsage.percentage > 80) score -= 15;
    if (metrics.memoryUsage.percentage > 90) score -= 35;
    
    // Concurrency penalty
    if (metrics.activeRequests > 200) score -= 10;
    if (metrics.activeRequests > 500) score -= 40;
    
    return Math.max(0, score);
  }

  private getRecommendations(metrics: ConcurrencyMetrics): string[] {
    const recommendations: string[] = [];
    
    if (metrics.avgResponseTime > 3000) {
      recommendations.push('🐌 High response time detected - Consider enabling caching or optimizing queries');
    }
    
    if (metrics.errorRate > 10) {
      recommendations.push('⚠️ High error rate - Check logs for recurring issues');
    }
    
    if (metrics.memoryUsage.percentage > 85) {
      recommendations.push('💾 High memory usage - Consider clearing caches or scaling horizontally');
    }
    
    if (metrics.activeRequests > 300) {
      recommendations.push('🚀 High concurrency - Consider load balancing or connection pooling');
    }
    
    if (metrics.requestsPerSecond > 50) {
      recommendations.push('📈 High RPS detected - Monitor Facebook API rate limits');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ System performing optimally');
    }
    
    return recommendations;
  }

  reset(): void {
    this.metrics = {
      activeRequests: 0,
      peakConcurrency: 0,
      totalRequests: 0,
      avgResponseTime: 0,
      errorRate: 0,
      lastResetTime: Date.now(),
      requestsPerSecond: 0,
      memoryUsage: { used: 0, total: 0, percentage: 0 },
      systemLoad: { cpu: 0, connections: 0 }
    };
    this.requestTimes = [];
    this.errors = 0;
    this.requestTimestamps = [];
    console.log('📊 Concurrency metrics reset');
  }

  // Real-time alerts for critical thresholds
  checkAlerts(): { critical: string[]; warnings: string[] } {
    const metrics = this.getMetrics();
    const critical: string[] = [];
    const warnings: string[] = [];

    // Critical alerts
    if (metrics.activeRequests > 800) {
      critical.push(`CRITICAL: ${metrics.activeRequests} concurrent requests (approaching 1000 limit)`);
    }
    
    if (metrics.avgResponseTime > 10000) {
      critical.push(`CRITICAL: Average response time ${metrics.avgResponseTime.toFixed(0)}ms (>10s)`);
    }
    
    if (metrics.memoryUsage.percentage > 90) {
      critical.push(`CRITICAL: Memory usage ${metrics.memoryUsage.percentage}% (>90%)`);
    }

    // Warning alerts
    if (metrics.activeRequests > 500) {
      warnings.push(`WARNING: High concurrency (${metrics.activeRequests} active requests)`);
    }
    
    if (metrics.avgResponseTime > 5000) {
      warnings.push(`WARNING: Slow responses (${metrics.avgResponseTime.toFixed(0)}ms average)`);
    }
    
    if (metrics.errorRate > 15) {
      warnings.push(`WARNING: High error rate (${metrics.errorRate.toFixed(1)}%)`);
    }

    return { critical, warnings };
  }
}

export const monitor = new ConcurrencyMonitor();

// Auto-monitoring with alerts
setInterval(() => {
  const alerts = monitor.checkAlerts();
  
  if (alerts.critical.length > 0) {
    console.error('🚨 CRITICAL ALERTS:');
    alerts.critical.forEach(alert => console.error(alert));
  }
  
  if (alerts.warnings.length > 0) {
    console.warn('⚠️ WARNINGS:');
    alerts.warnings.forEach(warning => console.warn(warning));
  }
}, 10000); // Check every 10 seconds
