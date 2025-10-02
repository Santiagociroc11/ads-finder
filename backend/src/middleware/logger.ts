import type { Request, Response, NextFunction } from 'express';

export const logger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  // Skip logging for health check endpoint
  if (req.url === '/api/health') {
    next();
    return;
  }
  
  // Log request
  console.log(`📝 ${timestamp} ${req.method} ${req.url}`);
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    
    // Determine status emoji
    let statusEmoji = '✅';
    if (status >= 400 && status < 500) {
      statusEmoji = '⚠️ ';
    } else if (status >= 500) {
      statusEmoji = '❌';
    }
    
    console.log(
      `${statusEmoji} ${status} ${req.method} ${req.url} - ${duration}ms`
    );
  });
  
  next();
};
