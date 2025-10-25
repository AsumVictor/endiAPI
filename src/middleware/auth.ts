// Authentication middleware
import type { Request, Response, NextFunction } from 'express';
import { JWTService } from '../utils/jwt.ts';
import { AuthService } from '../services/auth.ts';
import { AppError } from '../utils/errors.ts';
import type { User } from '../models/user.ts';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateToken = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // First try to get token from Authorization header (Bearer token)
    let token = req.headers.authorization && req.headers.authorization.split(' ')[1];
    
    // If no token in header, try to get from HTTP-only cookie
    if (!token) {
      token = req.cookies?.['access_token'];
    }

    if (!token) {
      _res.status(401).json({ success: false, error: 'Access token required' });
      return;
    }

    // Verify the token
    const payload = JWTService.verifyAccessToken(token);
    
    // Get user data from database
    const user = await AuthService.getUserById(payload.sub);

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Invalid or expired token', 401));
    }
  }
};

/**
 * Middleware to check if user has specific role
 */
export const requireRole = (roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!roles.includes(req.user.role)) {
      _res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = requireRole(['admin']);

/**
 * Middleware to check if user is instructor or admin
 */
export const requireInstructor = requireRole(['instructor', 'admin']);

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const payload = JWTService.verifyAccessToken(token);
        const user = await AuthService.getUserById(payload.sub);
        
        if (user.is_active) {
          req.user = user;
        }
      } catch (error) {
        // Ignore token errors for optional auth
        console.log('Optional auth token error:', error);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if user owns the resource
 */
export const requireOwnership = (userIdParam: string = 'userId') => {
  return (req: Request, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const resourceUserId = req.params[userIdParam];
    
    if (req.user.role === 'admin') {
      // Admins can access any resource
      return next();
    }

    if (req.user.id !== resourceUserId) {
      return next(new AppError('Access denied: You can only access your own resources', 403));
    }

    next();
  };
};
