import dotenv from 'dotenv';
import path from 'path';

console.log('🔍 Testing .env loading from different modules...\n');

// Test 1: Direct loading (like server.ts)
console.log('=== TEST 1: Direct loading ===');
const envPath = process.cwd().endsWith('backend') 
  ? path.join(process.cwd(), '..', '.env')
  : path.join(process.cwd(), '.env');

console.log('📁 Calculated path:', envPath);
const result = dotenv.config({ path: envPath });
console.log('📋 Result:', result.error ? `ERROR: ${result.error.message}` : 'SUCCESS');

console.log('\n=== CRITICAL VARIABLES ===');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'EXISTS' : 'MISSING');
console.log('MONGO_URL:', process.env.MONGO_URL ? 'EXISTS' : 'MISSING');
console.log('SEARCH_RATE_LIMIT:', process.env.SEARCH_RATE_LIMIT || 'MISSING');
console.log('SCRAPING_RATE_LIMIT:', process.env.SCRAPING_RATE_LIMIT || 'MISSING');
console.log('PORT:', process.env.PORT || 'MISSING');
console.log('FRONTEND_URL:', process.env.FRONTEND_URL || 'MISSING');

console.log('\n=== ALL LOADED ENV VARS ===');
const envVars = Object.keys(process.env).filter(key => 
  key.includes('RATE') || 
  key.includes('JWT') || 
  key.includes('MONGO') || 
  key.includes('PORT') ||
  key.includes('FRONTEND')
).sort();

envVars.forEach(key => {
  console.log(`${key}: ${process.env[key] ? 'SET' : 'NOT SET'}`);
});
