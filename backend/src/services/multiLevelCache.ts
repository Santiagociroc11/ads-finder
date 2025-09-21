import NodeCache from 'node-cache';

interface CacheStats {
  memoryCache: {
    keys: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
  totalHits: number;
  totalMisses: number;
  overallHitRate: number;
}

export class MultiLevelCache {
  private memoryCache: NodeCache;
  private stats = {
    memoryHits: 0,
    memoryMisses: 0,
    totalRequests: 0
  };

  constructor() {
    // Memory cache with optimized settings for 1000 users
    this.memoryCache = new NodeCache({
      stdTTL: 1800, // 30 minutes default
      checkperiod: 300, // Check every 5 minutes
      useClones: false, // Better performance
      maxKeys: 10000, // Support up to 10k cache entries
      deleteOnExpire: true
    });

    console.log('💾 Multi-level cache initialized for high concurrency');
  }

  async get<T>(key: string): Promise<T | null> {
    this.stats.totalRequests++;

    // Try memory cache first
    const memoryResult = this.memoryCache.get<T>(key);
    if (memoryResult !== undefined) {
      this.stats.memoryHits++;
      return memoryResult;
    }

    this.stats.memoryMisses++;
    return null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Store in memory cache
    if (ttl) {
      this.memoryCache.set(key, value, ttl);
    } else {
      this.memoryCache.set(key, value);
    }
  }

  async delete(key: string): Promise<void> {
    this.memoryCache.del(key);
  }

  async clear(): Promise<void> {
    this.memoryCache.flushAll();
    console.log('🗑️ Multi-level cache cleared');
  }

  // Smart cache warming for popular pageIds
  async warmCache(popularPageIds: string[]): Promise<void> {
    console.log(`🔥 Warming cache for ${popularPageIds.length} popular pages`);
    
    // This would be called with the most requested pageIds
    // to pre-populate cache during low-traffic periods
    for (const pageId of popularPageIds) {
      const cacheKey = `advertiser-stats:${pageId}:ALL`;
      const exists = await this.get(cacheKey);
      
      if (!exists) {
        console.log(`🔥 Cache miss for popular pageId: ${pageId} - consider pre-loading`);
      }
    }
  }

  getStats(): CacheStats {
    const memoryStats = this.memoryCache.getStats();
    const totalHits = this.stats.memoryHits;
    const totalMisses = this.stats.memoryMisses;
    const totalRequests = totalHits + totalMisses;

    return {
      memoryCache: {
        keys: memoryStats.keys,
        hits: this.stats.memoryHits,
        misses: this.stats.memoryMisses,
        hitRate: totalRequests > 0 ? (this.stats.memoryHits / totalRequests) * 100 : 0
      },
      totalHits,
      totalMisses,
      overallHitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0
    };
  }

  // Intelligent cache cleanup based on usage patterns
  cleanup(): void {
    const stats = this.memoryCache.getStats();
    console.log(`🧹 Cache cleanup - Keys: ${stats.keys}, Hits: ${stats.hits}, Misses: ${stats.misses}`);
    
    // If hit rate is low, reduce cache size
    const hitRate = stats.hits / (stats.hits + stats.misses) * 100;
    if (hitRate < 30) {
      console.log(`📉 Low hit rate (${hitRate.toFixed(1)}%), reducing cache size`);
      // Could implement LRU cleanup here
    }
  }
}

// Global instance
export const multiLevelCache = new MultiLevelCache();

// Cleanup every 10 minutes
setInterval(() => {
  multiLevelCache.cleanup();
}, 10 * 60 * 1000);
