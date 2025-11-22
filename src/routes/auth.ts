// Authentication routes
import { Router } from 'express';
import type { Request, Response } from 'express';
import expressValidator from 'express-validator';
const { body, validationResult } = expressValidator as any;
import { asyncHandler, AppError } from '../utils/errors.ts';
import { AuthService } from '../services/auth.ts';
import { authenticateToken } from '../middleware/auth.ts';
import { supabase, supabaseAuth } from '../config/database.ts';
import type { LoginRequest, RegisterRequest, RefreshTokenRequest } from '../models/user.ts';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - confirm_password
 *         - role
 *         - first_name
 *         - last_name
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *         password:
 *           type: string
 *           minLength: 6
 *           example: "password123"
 *         confirm_password:
 *           type: string
 *           minLength: 6
 *           example: "password123"
 *         role:
 *           type: string
 *           enum: [student, lecturer, admin]
 *           example: "student"
 *         first_name:
 *           type: string
 *           example: "John"
 *         last_name:
 *           type: string
 *           example: "Doe"
 *         class_year:
 *           type: integer
 *           example: 2024
 *           description: "Optional - can be filled later"
 *         major:
 *           type: string
 *           example: "Computer Science"
 *           description: "Optional - can be filled later"
 *         classes_teaching:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Machine Learning", "Python Programming"]
 *           description: "Optional - can be filled later"
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *         password:
 *           type: string
 *           example: "password123"
 *     RefreshTokenRequest:
 *       type: object
 *       required:
 *         - refresh_token
 *       properties:
 *         refresh_token:
 *           type: string
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     AuthTokens:
 *       type: object
 *       properties:
 *         access_token:
 *           type: string
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         refresh_token:
 *           type: string
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         expires_in:
 *           type: number
 *           example: 900
 *         token_type:
 *           type: string
 *           example: "Bearer"
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "uuid-here"
 *         email:
 *           type: string
 *           example: "user@example.com"
 *         role:
 *           type: string
 *           enum: [student, lecturer, admin]
 *           example: "student"
 *         created_at:
 *           type: string
 *           format: date-time
 *     Student:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "uuid-here"
 *         user_id:
 *           type: string
 *           example: "user-uuid-here"
 *         first_name:
 *           type: string
 *           example: "John"
 *         last_name:
 *           type: string
 *           example: "Doe"
 *         class_year:
 *           type: integer
 *           example: 2024
 *         major:
 *           type: string
 *           example: "Computer Science"
 *         bio:
 *           type: string
 *           example: "Passionate about programming"
 *         avatar_url:
 *           type: string
 *           example: "https://example.com/avatar.jpg"
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     Lecturer:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "uuid-here"
 *         user_id:
 *           type: string
 *           example: "user-uuid-here"
 *         first_name:
 *           type: string
 *           example: "Jane"
 *         last_name:
 *           type: string
 *           example: "Smith"
 *         bio:
 *           type: string
 *           example: "Expert in Machine Learning and Data Science"
 *         avatar_url:
 *           type: string
 *           example: "https://example.com/avatar.jpg"
 *         classes_teaching:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Machine Learning", "Python Programming", "Data Structures"]
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Operation successful"
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               $ref: '#/components/schemas/User'
 *             profile:
 *               oneOf:
 *                 - $ref: '#/components/schemas/Student'
 *                 - $ref: '#/components/schemas/Lecturer'
 *             tokens:
 *               $ref: '#/components/schemas/AuthTokens'
 */

// Validation middleware
const validateRegistration = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('confirm_password').isLength({ min: 6 }).withMessage('Confirm password must be at least 6 characters'),
  body('role').isIn(['student', 'lecturer', 'admin']).withMessage('Role must be student, lecturer, or admin'),
  body('first_name').isLength({ min: 2, max: 100 }).withMessage('First name must be 2-100 characters'),
  body('last_name').isLength({ min: 2, max: 100 }).withMessage('Last name must be 2-100 characters'),
  // Custom validation to check if passwords match
  body('confirm_password').custom((value: string, { req }: { req: Request }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const validateRefreshToken = [
  body('refresh_token').notEmpty().withMessage('Refresh token is required'),
];

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error or registration failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/register', 
  validateRegistration,
  asyncHandler(async (req: Request, res: Response) => {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
       res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
      return
    }

    const registerData: RegisterRequest = req.body;
    const result = await AuthService.register(registerData, req, res);
    
    res.status(201).json(result);
  })
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticate user with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login',
  validateLogin,
  asyncHandler(async (req: Request, res: Response) => {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
       res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
      return
    }

    const loginData: LoginRequest = req.body;
    const result = await AuthService.login(loginData, req, res);
    
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Get a new access token using refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/refresh',
  validateRefreshToken,
  asyncHandler(async (req: Request, res: Response) => {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
       res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    const refreshData: RefreshTokenRequest = req.body;
    const result = await AuthService.refreshToken(refreshData, req, res);
    
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     description: Get the authenticated user's profile information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
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
 *                   example: "User profile retrieved"
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/me',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      
      // Get the appropriate profile based on role
      let profile: any;
      
      if (user.role === 'student') {
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (studentError || !studentData) {
          throw new AppError('Student profile not found', 404);
        }
        profile = studentData;
      } else if (user.role === 'lecturer') {
        const { data: lecturerData, error: lecturerError } = await supabase
          .from('lecturers')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (lecturerError || !lecturerData) {
          throw new AppError('Lecturer profile not found', 404);
        }
        profile = lecturerData;
      } else {
        // For admin users, return basic profile
        profile = {
          id: user.id,
          user_id: user.id,
          first_name: 'Admin',
          last_name: 'User',
          created_at: user.created_at,
          updated_at: user.created_at
        };
      }

    res.status(200).json({
      success: true,
        message: 'User retrieved successfully',
        data: {
          user,
          profile
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve user profile', 500);
    }
  })
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Logout the authenticated user and invalidate tokens
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
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
 *                   example: "Logged out successfully"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/logout',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await AuthService.logout(req.user!.id, req, res);
    res.status(200).json(result);
    return;
  })
);

/**
 * @swagger
 * /api/auth/verify-email:
 *   get:
 *     summary: Verify email address
 *     description: Handle email verification callback from Supabase. When users click the confirmation link in their email, Supabase redirects here. This endpoint then redirects to the frontend with a success message.
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: Email verification token from Supabase
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Verification type (signup, recovery, etc.)
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         description: User email address
 *     responses:
 *       302:
 *         description: Redirects to frontend with verification status
 *         headers:
 *           Location:
 *             description: Frontend URL with query parameters
 *             schema:
 *               type: string
 *               example: "https://your-frontend.com/login?verified=true&message=Email verified successfully"
 *       400:
 *         description: Verification failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/verify-email', asyncHandler(async (req: Request, res: Response) => {
  const { token, type, email, access_token, error, error_description } = req.query;
  
  // Get frontend URL from environment variable
  const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:5173';

  // Supabase redirects here with either:
  // 1. Query params: ?token=...&type=signup&email=...
  // 2. Hash fragments: #access_token=... or #error=... (hash fragments don't come in query!)
  // 3. After verification, Supabase might redirect with no params (already verified server-side)

  // Check for errors first (from Supabase redirect)
  if (error) {
    const errorRedirectUrl = `${frontendUrl}/login?verified=false&error=${encodeURIComponent(error_description as string || error as string)}`;
    res.redirect(errorRedirectUrl);
    return;
  }

  // If access_token is provided in query (unlikely, usually in hash), Supabase already verified
  if (access_token) {
    const successRedirectUrl = `${frontendUrl}/login?verified=true&message=${encodeURIComponent('Email verified successfully. You can now login.')}`;
    res.redirect(successRedirectUrl);
    return;
  }

  // If token is provided, verify it
  if (token) {
    try {
      // Verify the email with Supabase using OTP verification
      const { data, error: verifyError } = await supabaseAuth.auth.verifyOtp({
      token: token as string,
        type: (type as 'signup' | 'recovery' | 'invite' | 'email_change') || 'signup',
        email: email as string
    });

      if (verifyError) {
        const errorRedirectUrl = `${frontendUrl}/login?verified=false&error=${encodeURIComponent(verifyError.message)}`;
        res.redirect(errorRedirectUrl);
        return;
    }

    if (!data.user) {
        const errorRedirectUrl = `${frontendUrl}/login?verified=false&error=${encodeURIComponent('Invalid verification token')}`;
        res.redirect(errorRedirectUrl);
        return;
    }

    // Success - redirect to frontend with success message
      const successRedirectUrl = `${frontendUrl}/login?verified=true&message=${encodeURIComponent('Email verified successfully. You can now login.')}`;
      res.redirect(successRedirectUrl);
      return;

    } catch (err: any) {
      const errorRedirectUrl = `${frontendUrl}/login?verified=false&error=${encodeURIComponent(err.message || 'Email verification failed')}`;
      res.redirect(errorRedirectUrl);
      return;
    }
  }

  // If no token/access_token but Supabase already verified server-side, redirect to success
  // This happens when Supabase verifies the email and redirects here without query params
  const successRedirectUrl = `${frontendUrl}/login?verified=true&message=${encodeURIComponent('Email verified successfully. You can now login.')}`;
  res.redirect(successRedirectUrl);
}));

export default router;
