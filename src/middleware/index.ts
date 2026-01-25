// Middleware configuration
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import config from '../config/index.js';
import logger from '../utils/logger.js';

// CORS middleware
const corsOptions = {
  origin: config.nodeEnv === 'development' 
    ? true // Accept all origins in development
    : config.cors.origin.split(','), // Use specific origins in production
  credentials: true, // Allow cookies to be sent
  optionsSuccessStatus: 200
};

export const corsMiddleware = cors(corsOptions);

// Rate limiting middleware - General API limiter
// More lenient in development, stricter in production
export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.nodeEnv === 'development' ? 1000 : 500, // Higher limit for development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req: Request) => {
    // Skip rate limiting for health checks and static files
    return _req.path === '/' || _req.path.startsWith('/static');
  },
});

// Stricter rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit auth attempts to prevent brute force
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Lenient rate limiter for heartbeat and answer endpoints (exam-taking)
export const examLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: config.nodeEnv === 'development' ? 300 : 120, // More lenient in dev, 120 requests/min in prod (2 per second)
  message: 'Too many requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Request logging middleware
const requestLogger = morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
});

// Security middleware
const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
    },
  },
});

// JWT Authentication middleware
export const authenticateToken = (req: Request, res: Response, next: Function): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ success: false, error: 'Access token required' });
    return;
  }

  // TODO: Implement JWT verification with Supabase
  // For now, just pass through
  next();
};

export {
  requestLogger,
  securityMiddleware
};