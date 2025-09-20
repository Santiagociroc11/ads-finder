import NodeCache from 'node-cache';

interface CacheStats {
  keys: number;
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsage: number;
}

class CacheService {
  private searchCache: NodeCache;
  private statsCache: NodeCache;
  private aiCache: NodeCache;
  private hits: number = 0;
  private misses: number = 0;

  constructor() {
    // Search results cache - 1 hour TTL
    this.searchCache = new NodeCache({
      stdTTL: 60 * 60, // 1 hour
      checkperiod: 10 * 60, // Check for expired keys every 10 minutes
      maxKeys: 1000, // Limit to 1000 cached searches
      useClones: false // Better performance
    });

    // Advertiser stats cache - 30 minutes TTL
    this.statsCache = new NodeCache({
      stdTTL: 30 * 60, // 30 minutes
      checkperiod: 5 * 60, // Check every 5 minutes
      maxKeys: 500, // Limit to 500 advertisers
      useClones: false
    });

    // AI suggestions cache - 24 hours TTL
    this.aiCache = new NodeCache({
      stdTTL: 24 * 60 * 60, // 24 hours
      checkperiod: 60 * 60, // Check every hour
      maxKeys: 200, // Limit to 200 AI suggestions
      useClones: false
    });

    // Setup event listeners for cache statistics
    this.setupEventListeners();

    console.log('💾 Cache service initialized with optimized TTL settings');
  }

  private setupEventListeners(): void {
    [this.searchCache, this.statsCache, this.aiCache].forEach(cache => {
      cache.on('set', (key, value) => {
        // Optional: Log cache sets in debug mode
      });

      cache.on('del', (key, value) => {
        // Optional: Log cache deletions in debug mode
      });

      cache.on('expired', (key, value) => {
        console.log(`💾 Cache expired: ${key}`);
      });
    });
  }

  // Search results caching
  getSearchResult(key: string): any {
    const result = this.searchCache.get(key);
    if (result) {
      this.hits++;
      console.log(`💾 Cache HIT for search: ${key}`);
      return result;
    } else {
      this.misses++;
      console.log(`💾 Cache MISS for search: ${key}`);
      return null;
    }
  }

  setSearchResult(key: string, data: any, ttl?: number): void {
    if (ttl) {
      this.searchCache.set(key, data, ttl);
    } else {
      this.searchCache.set(key, data);
    }
    console.log(`💾 Cached search result: ${key}`);
  }

  // Advertiser stats caching
  getAdvertiserStats(pageId: string): any {
    const result = this.statsCache.get(`stats:${pageId}`);
    if (result) {
      this.hits++;
      console.log(`💾 Cache HIT for stats: ${pageId}`);
      return result;
    } else {
      this.misses++;
      return null;
    }
  }

  setAdvertiserStats(pageId: string, stats: any, ttl?: number): void {
    if (ttl) {
      this.statsCache.set(`stats:${pageId}`, stats, ttl);
    } else {
      this.statsCache.set(`stats:${pageId}`, stats);
    }
    console.log(`💾 Cached advertiser stats: ${pageId}`);
  }

  // AI suggestions caching
  getAISuggestion(idea: string): any {
    const key = `ai:${idea.toLowerCase().trim()}`;
    const result = this.aiCache.get(key);
    if (result) {
      this.hits++;
      console.log(`💾 Cache HIT for AI: ${idea}`);
      return result;
    } else {
      this.misses++;
      return null;
    }
  }

  setAISuggestion(idea: string, suggestions: any, ttl?: number): void {
    const key = `ai:${idea.toLowerCase().trim()}`;
    if (ttl) {
      this.aiCache.set(key, suggestions, ttl);
    } else {
      this.aiCache.set(key, suggestions);
    }
    console.log(`💾 Cached AI suggestions: ${idea}`);
  }

  // Cache management
  clearAll(): void {
    this.searchCache.flushAll();
    this.statsCache.flushAll();
    this.aiCache.flushAll();
    this.hits = 0;
    this.misses = 0;
    console.log('💾 All caches cleared');
  }

  clearExpired(): void {
    const searchDeleted = this.searchCache.keys().length;
    const statsDeleted = this.statsCache.keys().length;
    const aiDeleted = this.aiCache.keys().length;
    
    this.searchCache.flushAll();
    this.statsCache.flushAll();
    this.aiCache.flushAll();
    
    console.log(`💾 Cleared expired entries: ${searchDeleted + statsDeleted + aiDeleted} total`);
  }

  // Statistics
  getStats(): CacheStats {
    const totalKeys = this.searchCache.keys().length + 
                     this.statsCache.keys().length + 
                     this.aiCache.keys().length;

    const hitRate = this.hits + this.misses > 0 
      ? (this.hits / (this.hits + this.misses)) * 100 
      : 0;

    return {
      keys: totalKeys,
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryUsage: this.getMemoryUsage()
    };
  }

  private getMemoryUsage(): number {
    // Estimate memory usage in MB
    const searchStats = this.searchCache.getStats();
    const statsStats = this.statsCache.getStats();
    const aiStats = this.aiCache.getStats();
    
    return Math.round((searchStats.vsize + statsStats.vsize + aiStats.vsize) / 1024 / 1024);
  }

  // Health check
  isHealthy(): boolean {
    const stats = this.getStats();
    return stats.memoryUsage < 500; // Less than 500MB
  }

  // Generate cache key for search
  generateSearchKey(params: any): string {
    const { value, country, searchType, adType, mediaType, languages, minDays, useApify } = params;
    return `search:${searchType}:${value}:${country}:${adType}:${mediaType}:${languages?.join(',') || 'all'}:${minDays}:${useApify}`;
  }
}

// Global cache instance
export const cacheService = new CacheService();

// Cleanup interval - every hour
setInterval(() => {
  const stats = cacheService.getStats();
  console.log(`💾 Cache stats - Keys: ${stats.keys}, Hit rate: ${stats.hitRate}%, Memory: ${stats.memoryUsage}MB`);
  
  // Clear if memory usage is too high
  if (stats.memoryUsage > 400) {
    console.log('💾 High memory usage detected, clearing expired entries');
    cacheService.clearExpired();
  }
}, 60 * 60 * 1000); // Every hour
