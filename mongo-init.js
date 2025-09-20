// MongoDB initialization script
db = db.getSiblingDB('adFinder');

// Create collections
db.createCollection('ads');
db.createCollection('completeSearches');
db.createCollection('savedAds');
db.createCollection('trackedPages');
db.createCollection('users');

// Create indexes for performance
print('Creating indexes...');

// Ads collection indexes
db.ads.createIndex({ "ad_id": 1 }, { unique: true });
db.ads.createIndex({ "page_id": 1 });
db.ads.createIndex({ "ad_creation_time": -1 });
db.ads.createIndex({ "ad_delivery_start_time": -1 });

// Complete searches indexes
db.completeSearches.createIndex({ "createdAt": -1 });
db.completeSearches.createIndex({ "searchName": 1 });

// Saved ads indexes
db.savedAds.createIndex({ "ad_id": 1 });
db.savedAds.createIndex({ "collection": 1 });
db.savedAds.createIndex({ "tags": 1 });
db.savedAds.createIndex({ "savedAt": -1 });

// Tracked pages indexes
db.trackedPages.createIndex({ "page_id": 1 }, { unique: true });
db.trackedPages.createIndex({ "page_name": 1 });

// Users collection indexes
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "createdAt": -1 });

print('Database initialized successfully!');
