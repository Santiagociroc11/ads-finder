import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { TrackedAdvertiser } from '../models/TrackedAdvertiser.js';
import { collections } from '../services/database.js';
import { PlanLimitsService } from '../services/planLimitsService.js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/adFinder';

async function testPlanLimits() {
  console.log('🧪 Testing Plan Limits...');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find a user with FREE plan
    const freeUser = await User.findOne({ 'plan.type': 'free' });
    if (!freeUser) {
      console.log('❌ No user with FREE plan found');
      return;
    }

    console.log(`\n📋 Testing user: ${freeUser.email} (${freeUser.plan.type})`);
    console.log(`   Plan limits: ${freeUser.plan.trackedAdvertisersLimit} tracked advertisers, ${freeUser.plan.savedAdsLimit} saved ads`);

    // Test tracked advertisers limit
    console.log('\n🔍 Testing tracked advertisers limit...');
    const trackedLimit = await PlanLimitsService.checkTrackedAdvertisersLimit(freeUser._id.toString());
    console.log(`   Can add: ${trackedLimit.canAdd}`);
    console.log(`   Current count: ${trackedLimit.currentCount}`);
    console.log(`   Limit: ${trackedLimit.limit}`);

    // Test saved ads limit
    console.log('\n💾 Testing saved ads limit...');
    const savedLimit = await PlanLimitsService.checkSavedAdsLimit(freeUser._id.toString());
    console.log(`   Can save: ${savedLimit.canSave}`);
    console.log(`   Current count: ${savedLimit.currentCount}`);
    console.log(`   Limit: ${savedLimit.limit}`);
    console.log(`   Ads remaining: ${savedLimit.adsRemaining}`);

    // Test with a PIONEROS user
    const pionerosUser = await User.findOne({ 'plan.type': 'pioneros' });
    if (pionerosUser) {
      console.log(`\n📋 Testing user: ${pionerosUser.email} (${pionerosUser.plan.type})`);
      console.log(`   Plan limits: ${pionerosUser.plan.trackedAdvertisersLimit} tracked advertisers, ${pionerosUser.plan.savedAdsLimit} saved ads`);

      const pionerosTrackedLimit = await PlanLimitsService.checkTrackedAdvertisersLimit(pionerosUser._id.toString());
      console.log(`   Can add tracked advertisers: ${pionerosTrackedLimit.canAdd}`);
      console.log(`   Current count: ${pionerosTrackedLimit.currentCount}`);

      const pionerosSavedLimit = await PlanLimitsService.checkSavedAdsLimit(pionerosUser._id.toString());
      console.log(`   Can save ads: ${pionerosSavedLimit.canSave}`);
      console.log(`   Current count: ${pionerosSavedLimit.currentCount}`);
    }

    console.log('\n✅ Plan limits test completed');

  } catch (error) {
    console.error('❌ Error testing plan limits:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testPlanLimits();
