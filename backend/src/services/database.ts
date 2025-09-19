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
      this.client = new MongoClient(mongoUrl);
      await this.client.connect();
      this.db = this.client.db(dbName);
      
      // Test the connection
      await this.db.admin().ping();
      console.log(`📦 Connected to MongoDB: ${dbName}`);
      
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
  savedAds: databaseService.savedAds,
  completeSearches: databaseService.completeSearches,
  trackedPages: databaseService.trackedPages,
  users: databaseService.users,
};

export { databaseService };
