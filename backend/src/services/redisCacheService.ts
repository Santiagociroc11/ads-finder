import { createClient, RedisClientType } from 'redis';
import type { SearchParams, SearchResponse, AdData } from '../types/shared.js';

export class RedisCacheService {
  private client: RedisClientType;
  private isConnected = false;

  constructor() {
    this.client = createClient({
      url: 'redis://default:1ca59267dd10d890cf1a@92.112.184.72:9911'
    });

    this.client.on('error', (err) => {
      console.error('[REDIS] ❌ Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('[REDIS] ✅ Connected to Redis');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      console.log('[REDIS] 🔌 Disconnected from Redis');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.client.connect();
        console.log('[REDIS] 🚀 Redis connection established');
      } catch (error) {
        console.error('[REDIS] ❌ Failed to connect to Redis:', error);
        throw error;
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  private generateCacheKey(params: SearchParams): string {
    // Create a unique key based on search parameters (excluding page/limit for sharing cache)
    const { page, limit, offset, ...searchParams } = params;
    const keyData = {
      ...searchParams,
      // Normalize country code
      country: searchParams.country || 'CO'
    };
    return `search:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
  }

  async getSearchResult(params: SearchParams): Promise<SearchResponse | null> {
    if (!this.isConnected) {
      console.log('[REDIS] ⚠️ Redis not connected, skipping cache');
      return null;
    }

    try {
      const key = this.generateCacheKey(params);
      const cached = await this.client.get(key);
      
      if (cached) {
        console.log(`[REDIS] ✅ Cache hit for search: "${params.value}"`);
        try {
          if (typeof cached === 'string') {
            return JSON.parse(cached);
          } else if (typeof cached === 'object' && cached !== null) {
            // If it's already an object, return it directly
            return cached as SearchResponse;
          } else {
            console.error('[REDIS] ❌ Unexpected cached data type:', typeof cached);
            return null;
          }
        } catch (parseError) {
          console.error('[REDIS] ❌ Error parsing cached data:', parseError);
          return null;
        }
      }
      
      return null;
    } catch (error) {
      console.error('[REDIS] ❌ Error getting from cache:', error);
      return null;
    }
  }

  async setSearchResult(params: SearchParams, result: SearchResponse, ttlMinutes: number = 30): Promise<void> {
    if (!this.isConnected) {
      console.log('[REDIS] ⚠️ Redis not connected, skipping cache set');
      return;
    }

    try {
      const key = this.generateCacheKey(params);
      const ttlSeconds = ttlMinutes * 60;
      
      await this.client.setEx(key, ttlSeconds, JSON.stringify(result));
      console.log(`[REDIS] 💾 Cached search result for: "${params.value}" (TTL: ${ttlMinutes}m)`);
    } catch (error) {
      console.error('[REDIS] ❌ Error setting cache:', error);
    }
  }

  async invalidateSearchPattern(pattern: string): Promise<void> {
    if (!this.isConnected) {
      console.log('[REDIS] ⚠️ Redis not connected, skipping cache invalidation');
      return;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        console.log(`[REDIS] 🗑️ Invalidated ${keys.length} cache entries matching: ${pattern}`);
      }
    } catch (error) {
      console.error('[REDIS] ❌ Error invalidating cache:', error);
    }
  }

  async getCacheStats(): Promise<{ totalKeys: number; memoryUsage: string }> {
    if (!this.isConnected) {
      return { totalKeys: 0, memoryUsage: '0B' };
    }

    try {
      const info = await this.client.info('memory');
      const keys = await this.client.keys('search:*');
      
      // Parse memory usage from Redis info
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'Unknown';
      
      return {
        totalKeys: keys.length,
        memoryUsage
      };
    } catch (error) {
      console.error('[REDIS] ❌ Error getting cache stats:', error);
      return { totalKeys: 0, memoryUsage: 'Error' };
    }
  }

  // Individual Ad Caching
  async getAd(adId: string): Promise<AdData | null> {
    if (!this.isConnected) {
      return null;
    }

    try {
      const key = `ad:${adId}`;
      const cached = await this.client.get(key);
      
      if (cached) {
        console.log(`[REDIS] ✅ Ad cache hit for: ${adId}`);
        try {
          if (typeof cached === 'string') {
            return JSON.parse(cached);
          } else if (typeof cached === 'object' && cached !== null) {
            return cached as AdData;
          }
        } catch (parseError) {
          console.error('[REDIS] ❌ Error parsing ad cache:', parseError);
        }
      }
      
      return null;
    } catch (error) {
      console.error('[REDIS] ❌ Error getting ad from cache:', error);
      return null;
    }
  }

  async setAd(adId: string, adData: AdData, ttlMinutes: number = 60): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const key = `ad:${adId}`;
      const ttlSeconds = ttlMinutes * 60;
      
      await this.client.setEx(key, ttlSeconds, JSON.stringify(adData));
      console.log(`[REDIS] 💾 Cached ad: ${adId} (TTL: ${ttlMinutes}m)`);
    } catch (error) {
      console.error('[REDIS] ❌ Error caching ad:', error);
    }
  }

  // Advertiser Stats Caching
  async getAdvertiserStats(pageId: string, country: string): Promise<{ totalActiveAds: number; loading: boolean } | null> {
    if (!this.isConnected) {
      return null;
    }

    try {
      const key = `advertiser:${pageId}:${country}`;
      const cached = await this.client.get(key);
      
      if (cached) {
        console.log(`[REDIS] ✅ Advertiser stats cache hit for: ${pageId} in ${country}`);
        try {
          if (typeof cached === 'string') {
            return JSON.parse(cached);
          } else if (typeof cached === 'object' && cached !== null) {
            return cached as { totalActiveAds: number; loading: boolean };
          }
        } catch (parseError) {
          console.error('[REDIS] ❌ Error parsing advertiser stats cache:', parseError);
        }
      }
      
      return null;
    } catch (error) {
      console.error('[REDIS] ❌ Error getting advertiser stats from cache:', error);
      return null;
    }
  }

  async setAdvertiserStats(pageId: string, country: string, stats: { totalActiveAds: number; loading: boolean }, ttlMinutes: number = 15): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const key = `advertiser:${pageId}:${country}`;
      const ttlSeconds = ttlMinutes * 60;
      
      await this.client.setEx(key, ttlSeconds, JSON.stringify(stats));
      console.log(`[REDIS] 💾 Cached advertiser stats: ${pageId} in ${country} (TTL: ${ttlMinutes}m)`);
    } catch (error) {
      console.error('[REDIS] ❌ Error caching advertiser stats:', error);
    }
  }

  // Batch Ad Caching
  async setAds(ads: AdData[], ttlMinutes: number = 60): Promise<void> {
    if (!this.isConnected || ads.length === 0) {
      return;
    }

    try {
      const pipeline = this.client.multi();
      const ttlSeconds = ttlMinutes * 60;
      
      for (const ad of ads) {
        const key = `ad:${ad.id}`;
        pipeline.setEx(key, ttlSeconds, JSON.stringify(ad));
      }
      
      await pipeline.exec();
      console.log(`[REDIS] 💾 Batch cached ${ads.length} ads (TTL: ${ttlMinutes}m)`);
    } catch (error) {
      console.error('[REDIS] ❌ Error batch caching ads:', error);
    }
  }

  // Cache invalidation by patterns
  async invalidateAdvertiserStats(pageId: string): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const pattern = `advertiser:${pageId}:*`;
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        console.log(`[REDIS] 🗑️ Invalidated ${keys.length} advertiser stats for page: ${pageId}`);
      }
    } catch (error) {
      console.error('[REDIS] ❌ Error invalidating advertiser stats:', error);
    }
  }

  async invalidateAd(adId: string): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const key = `ad:${adId}`;
      await this.client.del(key);
      console.log(`[REDIS] 🗑️ Invalidated ad: ${adId}`);
    } catch (error) {
      console.error('[REDIS] ❌ Error invalidating ad:', error);
    }
  }

  // Enhanced cache stats
  async getDetailedCacheStats(): Promise<{
    searchKeys: number;
    adKeys: number;
    advertiserKeys: number;
    totalKeys: number;
    memoryUsage: string;
  }> {
    if (!this.isConnected) {
      return { searchKeys: 0, adKeys: 0, advertiserKeys: 0, totalKeys: 0, memoryUsage: '0B' };
    }

    try {
      const [searchKeys, adKeys, advertiserKeys, info] = await Promise.all([
        this.client.keys('search:*'),
        this.client.keys('ad:*'),
        this.client.keys('advertiser:*'),
        this.client.info('memory')
      ]);
      
      // Parse memory usage from Redis info
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'Unknown';
      
      return {
        searchKeys: searchKeys.length,
        adKeys: adKeys.length,
        advertiserKeys: advertiserKeys.length,
        totalKeys: searchKeys.length + adKeys.length + advertiserKeys.length,
        memoryUsage
      };
    } catch (error) {
      console.error('[REDIS] ❌ Error getting detailed cache stats:', error);
      return { searchKeys: 0, adKeys: 0, advertiserKeys: 0, totalKeys: 0, memoryUsage: 'Error' };
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const redisCacheService = new RedisCacheService();
