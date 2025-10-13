import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { collections } from '../services/database.js';

/**
 * Migration script to add plan information to existing users
 */
async function migrateUsersToPlans() {
  try {
    console.log('🔄 Starting user plans migration...');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/adFinder');
    console.log('✅ Connected to MongoDB');

    // Get all users from the old collection
    const oldUsers = await collections.users.find({}).toArray();
    console.log(`📊 Found ${oldUsers.length} users to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const oldUser of oldUsers) {
      try {
        // Check if user already has plan information
        if (oldUser.plan && oldUser.usage) {
          console.log(`⏭️  Skipping user ${oldUser.email} - already has plan info`);
          skippedCount++;
          continue;
        }

        // Create new user document with plan information
        const newUser = {
          email: oldUser.email,
          name: oldUser.name,
          password: oldUser.password,
          role: oldUser.role || 'user',
          telegramId: oldUser.telegramId,
          analysisTime: oldUser.analysisTime,
          
          // Add default plan information
          plan: {
            type: 'free',
            name: 'GRATIS',
            adsLimit: 100,
            features: ['Búsquedas básicas', 'Hasta 100 anuncios por mes', 'Soporte por email']
          },
          
          // Add default usage tracking
          usage: {
            currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
            adsFetched: 0,
            searchesPerformed: 0,
            lastResetDate: new Date()
          },
          
          // Add subscription info
          subscription: {
            status: 'active',
            startDate: new Date(),
            autoRenew: true
          },
          
          createdAt: oldUser.createdAt ? new Date(oldUser.createdAt) : new Date(),
          updatedAt: new Date()
        };

        // Update the user in the old collection
        await collections.users.updateOne(
          { _id: oldUser._id },
          { 
            $set: {
              plan: newUser.plan,
              usage: newUser.usage,
              subscription: newUser.subscription,
              updatedAt: newUser.updatedAt
            }
          }
        );

        migratedCount++;
        console.log(`✅ Migrated user: ${oldUser.email}`);

      } catch (error) {
        console.error(`❌ Error migrating user ${oldUser.email}:`, error);
      }
    }

    console.log('\n🎉 Migration completed!');
    console.log(`✅ Migrated: ${migratedCount} users`);
    console.log(`⏭️  Skipped: ${skippedCount} users`);
    console.log(`📊 Total processed: ${migratedCount + skippedCount} users`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateUsersToPlans();
}

export { migrateUsersToPlans };
