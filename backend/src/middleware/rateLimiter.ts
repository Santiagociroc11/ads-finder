import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';

// Load .env variables first (same logic as server.ts)
const envPath = process.cwd().endsWith('backend') 
  ? path.join(process.cwd(), '..', '.env')
  : path.join(process.cwd(), '.env');
dotenv.config({ path: envPath });

console.log('🎯 RATE LIMITS FROM .ENV (rateLimiter.ts):');
console.log(`📊 SEARCH_RATE_LIMIT: ${process.env.SEARCH_RATE_LIMIT}`);
console.log(`⏰ SEARCH_WINDOW_MS: ${process.env.SEARCH_WINDOW_MS}`);
console.log(`🤖 AI_RATE_LIMIT: ${process.env.AI_RATE_LIMIT}`);
console.log(`🕷️ SCRAPING_RATE_LIMIT: ${process.env.SCRAPING_RATE_LIMIT}`);
console.log(`🌐 API_RATE_LIMIT: ${process.env.API_RATE_LIMIT}`);

// Store for rate limiting (in-memory for now, Redis for production)
const store = new Map<string, { count: number; resetTime: number }>();

// Custom store implementation for rate limiting
class CustomStore {
  incr(key: string, callback: (error: Error | null, result?: number) => void) {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    
    const record = store.get(key);
    
    if (!record || now > record.resetTime) {
      // New window or expired
      const newRecord = { count: 1, resetTime: now + windowMs };
      store.set(key, newRecord);
      callback(null, 1);
    } else {
      // Increment existing
      record.count++;
      store.set(key, record);
      callback(null, record.count);
    }
  }

  decrement(key: string) {
    const record = store.get(key);
    if (record && record.count > 0) {
      record.count--;
      store.set(key, record);
    }
  }

  resetKey(key: string) {
    store.delete(key);
  }
}

// Key generator that includes user ID if available
const keyGenerator = (req: Request): string => {
  const userId = req.user?._id || 'anonymous';
  return `user:${userId}`;
};

// Rate limiter for search endpoints (most critical)
// The .env loading happens in server.ts, so these variables should be available now

export const searchRateLimit = rateLimit({
  windowMs: parseInt(process.env.SEARCH_WINDOW_MS || '900000'), // 15 minutes default
  max: parseInt(process.env.SEARCH_RATE_LIMIT || '10'), // 10 requests default
  message: {
    error: 'Demasiadas búsquedas realizadas',
    message: 'Has alcanzado el límite de búsquedas. Intenta nuevamente en 15 minutos.',
    retryAfter: 15 * 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  store: new CustomStore() as any
});

// Rate limiter for AI suggestions (expensive)
export const aiRateLimit = rateLimit({
  windowMs: parseInt(process.env.AI_WINDOW_MS || '900000'), // 15 minutes default
  max: parseInt(process.env.AI_RATE_LIMIT || '5'), // 5 requests default
  message: {
    error: 'Demasiadas solicitudes de IA',
    message: 'Has alcanzado el límite de sugerencias de IA. Intenta nuevamente en 15 minutos.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  store: new CustomStore() as any
});

// Rate limiter for scraping (very expensive)
export const scrapingRateLimit = rateLimit({
  windowMs: parseInt(process.env.SCRAPING_WINDOW_MS || '3600000'), // 1 hour default
  max: parseInt(process.env.SCRAPING_RATE_LIMIT || '3'), // 3 requests default
  message: {
    error: 'Demasiadas solicitudes de stats',
    message: 'Has alcanzado el límite de estadísticas. Intenta nuevamente en 15 minutos.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  store: new CustomStore() as any
});

// General API rate limiter
export const apiRateLimit = rateLimit({
  windowMs: parseInt(process.env.API_WINDOW_MS || '60000'), // 1 minute default
  max: parseInt(process.env.API_RATE_LIMIT || '100'), // 100 requests default
  message: {
    error: 'Demasiadas solicitudes',
    message: 'Has realizado demasiadas solicitudes. Intenta nuevamente en un minuto.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  store: new CustomStore() as any
});

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now > record.resetTime) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000); // Cleanup every 5 minutes

console.log('🛡️ Rate limiting middleware initialized');
