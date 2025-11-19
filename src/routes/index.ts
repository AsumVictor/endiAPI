// Main routes configuration
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/errors.ts';
import config from '../config/index.ts';
import authRoutes from './auth.ts';
import courseRoutes from './course.ts';
import videoRoutes from './video.ts';
import lecturerRoutes from './lecturer.ts';

const router = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the current health status of the API server
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Server is running"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime_seconds:
 *                   type: number
 *                   example: 123.45
 *                 environment:
 *                   type: string
 *                   example: "development"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 */
router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    version: '1.0.0'
  });
}));

/**
 * @swagger
 * /api/:
 *   get:
 *     summary: Root endpoint
 *     description: Returns API information and available endpoints
 *     tags: [General]
 *     responses:
 *       200:
 *         description: API information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the API Server with Supabase',
    version: '1.0.0',
    environment: config.nodeEnv,
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      courses: '/api/courses'
    },
    documentation: {
      swagger: '/api-docs',
      openapi: '/api-docs.json'
    }
  });
}));

// Auth routes placeholder
router.get('/auth/status', asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Auth service is ready',
    supabase: {
      url: config.supabase.url ? 'configured' : 'not configured'
    }
  });
}));

// Mount auth routes
router.use('/auth', authRoutes);

// Mount lecturer routes
router.use('/lecturers', lecturerRoutes);

// Mount course routes
router.use('/courses', courseRoutes);

// Mount video routes
router.use('/videos', videoRoutes);

export default router;