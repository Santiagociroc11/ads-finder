import { MongoClient, Db, Collection } from 'mongodb';
import type { 
  SavedAd, 
  CompleteSearch, 
  TrackedPage,
  CompleteSearchListItem,
  User 
} from '@shared/types/index.js';

class DatabaseService {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(): Promise<void> {
    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
    const dbName = process.env.DB_NAME || 'adFinder';

    try {
      // Optimized connection settings for 1000+ users
      this.client = new MongoClient(mongoUrl, {
        maxPoolSize: 50,              // Maximum 50 connections in pool
        minPoolSize: 5,               // Minimum 5 connections always open
        maxIdleTimeMS: 30000,         // Close connections after 30s idle
        serverSelectionTimeoutMS: 5000, // 5s timeout for server selection
        socketTimeoutMS: 45000,       // 45s socket timeout
        family: 4,                    // Use IPv4, skip IPv6 resolution
        connectTimeoutMS: 10000,      // 10s connection timeout
        heartbeatFrequencyMS: 10000,  // Heartbeat every 10s
        retryWrites: true,            // Retry failed writes
        retryReads: true,             // Retry failed reads
        compressors: ['zlib'],        // Enable compression
        zlibCompressionLevel: 6,      // Compression level
      });
      
      await this.client.connect();
      this.db = this.client.db(dbName);
      
      // Test the connection
      await this.db.admin().ping();
      console.log(`📦 Connected to MongoDB: ${dbName} with optimized connection pool`);
      console.log(`📦 Pool settings: maxPool=${50}, minPool=${5}, maxIdle=${30}s`);
      
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('📦 MongoDB connection closed');
    }
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  // Collection getters with proper typing
  get savedAds(): Collection<SavedAd> {
    return this.getDb().collection<SavedAd>('savedAds');
  }

  get completeSearches(): Collection<CompleteSearch> {
    return this.getDb().collection<CompleteSearch>('completeSearches');
  }

  get trackedPages(): Collection<TrackedPage> {
    return this.getDb().collection<TrackedPage>('trackedPages');
  }

  get users(): Collection<User & { password: string }> {
    return this.getDb().collection<User & { password: string }>('users');
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      if (!this.db) return false;
      await this.db.admin().ping();
      return true;
    } catch {
      return false;
    }
  }

  // Create indexes for better performance
  async createIndexes(): Promise<void> {
    if (!this.db) return;

    try {
      // Indexes for savedAds collection
      await this.savedAds.createIndex({ 'adData.id': 1 }, { unique: true });
      await this.savedAds.createIndex({ collection: 1 });
      await this.savedAds.createIndex({ tags: 1 });
      await this.savedAds.createIndex({ savedAt: -1 });
      await this.savedAds.createIndex({ isFavorite: 1 });

      // Indexes for completeSearches collection
      await this.completeSearches.createIndex({ searchName: 1 }, { unique: true });
      await this.completeSearches.createIndex({ executedAt: -1 });
      await this.completeSearches.createIndex({ source: 1 });
      await this.completeSearches.createIndex({ 'metadata.country': 1 });
      await this.completeSearches.createIndex({ 'metadata.searchTerm': 1 });
      await this.completeSearches.createIndex({ lastAccessed: -1 });
      
      // Additional performance indexes for 1000+ users
      await this.completeSearches.createIndex({ 
        'metadata.searchTerm': 'text',
        'metadata.country': 1,
        executedAt: -1 
      }, { background: true });
      await this.completeSearches.createIndex({ 
        source: 1, 
        'metadata.country': 1, 
        executedAt: -1 
      }, { background: true });

      // Indexes for trackedPages collection
      await this.trackedPages.createIndex({ pageId: 1 }, { unique: true });
      await this.trackedPages.createIndex({ createdAt: -1 });

      // Indexes for users collection
      await this.users.createIndex({ email: 1 }, { unique: true });
      await this.users.createIndex({ createdAt: -1 });
      await this.users.createIndex({ role: 1 });

      console.log('📊 Database indexes created successfully');
    } catch (error) {
      console.warn('⚠️  Could not create some indexes:', error);
    }
  }
}

// Singleton instance
const databaseService = new DatabaseService();

export const connectDatabase = async (): Promise<void> => {
  await databaseService.connect();
  await databaseService.createIndexes();
};

export const disconnectDatabase = async (): Promise<void> => {
  await databaseService.disconnect();
};

export const getDatabase = (): Db => {
  return databaseService.getDb();
};

export const collections = {
  get savedAds() { return databaseService.savedAds; },
  get completeSearches() { return databaseService.completeSearches; },
  get trackedPages() { return databaseService.trackedPages; },
  get users() { return databaseService.users; },
};

export { databaseService };
