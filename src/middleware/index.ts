// Middleware configuration
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import config from '../config/index.ts';
import logger from '../utils/logger.ts';

// CORS middleware
const corsOptions = {
  origin: config.nodeEnv === 'development' 
    ? true // Accept all origins in development
    : config.cors.origin.split(','), // Use specific origins in production
  credentials: true, // Allow cookies to be sent
  optionsSuccessStatus: 200
};

export const corsMiddleware = cors(corsOptions);

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
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
  limiter,
  requestLogger,
  securityMiddleware
};