import { Request, Response, NextFunction } from 'express';

interface SystemMetrics {
  requests: {
    total: number;
    byEndpoint: Map<string, number>;
    byStatus: Map<number, number>;
    errors: number;
  };
  performance: {
    avgResponseTime: number;
    slowRequests: number; // > 5 seconds
    totalResponseTime: number;
    requestCount: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
}

class MonitoringService {
  private metrics: SystemMetrics;
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      requests: {
        total: 0,
        byEndpoint: new Map(),
        byStatus: new Map(),
        errors: 0
      },
      performance: {
        avgResponseTime: 0,
        slowRequests: 0,
        totalResponseTime: 0,
        requestCount: 0
      },
      memory: {
        used: 0,
        total: 0,
        percentage: 0
      },
      uptime: 0
    };

    // Update memory stats every 30 seconds
    setInterval(() => {
      this.updateMemoryStats();
    }, 30000);

    console.log('📊 Monitoring service initialized');
  }

  private updateMemoryStats(): void {
    const memUsage = process.memoryUsage();
    this.metrics.memory = {
      used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    };
    this.metrics.uptime = Math.round((Date.now() - this.startTime) / 1000); // seconds
  }

  trackRequest(req: Request, res: Response, responseTime: number): void {
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    
    // Update request metrics
    this.metrics.requests.total++;
    this.metrics.requests.byEndpoint.set(
      endpoint,
      (this.metrics.requests.byEndpoint.get(endpoint) || 0) + 1
    );
    this.metrics.requests.byStatus.set(
      res.statusCode,
      (this.metrics.requests.byStatus.get(res.statusCode) || 0) + 1
    );

    if (res.statusCode >= 400) {
      this.metrics.requests.errors++;
    }

    // Update performance metrics
    this.metrics.performance.totalResponseTime += responseTime;
    this.metrics.performance.requestCount++;
    this.metrics.performance.avgResponseTime = 
      this.metrics.performance.totalResponseTime / this.metrics.performance.requestCount;

    if (responseTime > 5000) { // 5 seconds
      this.metrics.performance.slowRequests++;
      console.warn(`🐌 Slow request detected: ${endpoint} took ${responseTime}ms`);
    }

    // Log warnings for critical thresholds
    if (this.metrics.memory.percentage > 85) {
      console.warn(`🚨 High memory usage: ${this.metrics.memory.percentage}%`);
    }

    if (this.metrics.performance.avgResponseTime > 2000) {
      console.warn(`🚨 High average response time: ${this.metrics.performance.avgResponseTime}ms`);
    }
  }

  getMetrics(): SystemMetrics {
    this.updateMemoryStats();
    return JSON.parse(JSON.stringify(this.metrics));
  }

  getHealthStatus(): { status: 'healthy' | 'warning' | 'critical'; issues: string[] } {
    this.updateMemoryStats();
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Memory checks
    if (this.metrics.memory.percentage > 90) {
      issues.push(`Critical memory usage: ${this.metrics.memory.percentage}%`);
      status = 'critical';
    } else if (this.metrics.memory.percentage > 80) {
      issues.push(`High memory usage: ${this.metrics.memory.percentage}%`);
      if (status !== 'critical') status = 'warning';
    }

    // Performance checks
    if (this.metrics.performance.avgResponseTime > 5000) {
      issues.push(`Critical response time: ${this.metrics.performance.avgResponseTime}ms`);
      status = 'critical';
    } else if (this.metrics.performance.avgResponseTime > 2000) {
      issues.push(`High response time: ${this.metrics.performance.avgResponseTime}ms`);
      if (status !== 'critical') status = 'warning';
    }

    // Error rate checks
    const errorRate = this.metrics.requests.total > 0 
      ? (this.metrics.requests.errors / this.metrics.requests.total) * 100 
      : 0;
    
    if (errorRate > 10) {
      issues.push(`Critical error rate: ${errorRate.toFixed(1)}%`);
      status = 'critical';
    } else if (errorRate > 5) {
      issues.push(`High error rate: ${errorRate.toFixed(1)}%`);
      if (status !== 'critical') status = 'warning';
    }

    return { status, issues };
  }

  reset(): void {
    this.metrics = {
      requests: {
        total: 0,
        byEndpoint: new Map(),
        byStatus: new Map(),
        errors: 0
      },
      performance: {
        avgResponseTime: 0,
        slowRequests: 0,
        totalResponseTime: 0,
        requestCount: 0
      },
      memory: {
        used: 0,
        total: 0,
        percentage: 0
      },
      uptime: 0
    };
    console.log('📊 Monitoring metrics reset');
  }
}

// Global monitoring instance
export const monitoring = new MonitoringService();

// Middleware to track all requests
export const monitoringMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const responseTime = Date.now() - startTime;
    monitoring.trackRequest(req, res, responseTime);
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Health check endpoint data
export const getHealthData = () => {
  const health = monitoring.getHealthStatus();
  const metrics = monitoring.getMetrics();
  
  return {
    ...health,
    timestamp: new Date().toISOString(),
    uptime: metrics.uptime,
    memory: metrics.memory,
    performance: {
      avgResponseTime: Math.round(metrics.performance.avgResponseTime),
      slowRequests: metrics.performance.slowRequests,
      totalRequests: metrics.requests.total,
      errorRate: metrics.requests.total > 0 
        ? Math.round((metrics.requests.errors / metrics.requests.total) * 100 * 100) / 100
        : 0
    },
    topEndpoints: Array.from(metrics.requests.byEndpoint.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([endpoint, count]) => ({ endpoint, count }))
  };
};
