import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Store for rate limiting (in-memory for now, Redis for production)
const store = new Map<string, { count: number; resetTime: number }>();

// Custom store implementation for rate limiting
class CustomStore {
  incr(key: string, callback: (error: Error | null, result?: { totalHits: number; resetTime?: Date }) => void) {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    
    const record = store.get(key);
    
    if (!record || now > record.resetTime) {
      // New window or expired
      const newRecord = { count: 1, resetTime: now + windowMs };
      store.set(key, newRecord);
      callback(null, { totalHits: 1, resetTime: new Date(newRecord.resetTime) });
    } else {
      // Increment existing
      record.count++;
      store.set(key, record);
      callback(null, { totalHits: record.count, resetTime: new Date(record.resetTime) });
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
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  return `${userId}:${ip}`;
};

// Rate limiter for search endpoints (most critical)
export const searchRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 searches per 15 minutes per user
  message: {
    error: 'Demasiadas búsquedas realizadas',
    message: 'Has alcanzado el límite de búsquedas. Intenta nuevamente en 15 minutos.',
    retryAfter: 15 * 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  store: new CustomStore() as any,
  onLimitReached: (req: Request, res: Response) => {
    console.log(`🚨 Rate limit reached for search: ${keyGenerator(req)}`);
  }
});

// Rate limiter for AI suggestions (expensive)
export const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 AI requests per 15 minutes per user
  message: {
    error: 'Demasiadas solicitudes de IA',
    message: 'Has alcanzado el límite de sugerencias de IA. Intenta nuevamente en 15 minutos.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  store: new CustomStore() as any,
  onLimitReached: (req: Request, res: Response) => {
    console.log(`🚨 Rate limit reached for AI: ${keyGenerator(req)}`);
  }
});

// Rate limiter for scraping (very expensive)
export const scrapingRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 scraping requests per hour per user
  message: {
    error: 'Demasiadas solicitudes de scraping',
    message: 'Has alcanzado el límite de scraping. Intenta nuevamente en 1 hora.',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  store: new CustomStore() as any,
  onLimitReached: (req: Request, res: Response) => {
    console.log(`🚨 Rate limit reached for scraping: ${keyGenerator(req)}`);
  }
});

// General API rate limiter
export const apiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per user
  message: {
    error: 'Demasiadas solicitudes',
    message: 'Has realizado demasiadas solicitudes. Intenta nuevamente en un minuto.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  store: new CustomStore() as any,
  onLimitReached: (req: Request, res: Response) => {
    console.log(`🚨 Rate limit reached for API: ${keyGenerator(req)}`);
  }
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
