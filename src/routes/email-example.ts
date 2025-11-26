/**
 * Example email routes (for testing purposes)
 * 
 * NOTE: These routes are for testing email functionality.
 * In production, you should either:
 * 1. Remove these routes entirely
 * 2. Secure them with authentication middleware
 * 3. Move email sending to appropriate service methods
 * 
 * To use these routes, mount them in src/routes/index.ts:
 * import emailExampleRoutes from './email-example.ts';
 * router.use('/email', emailExampleRoutes);
 */
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { EmailService } from '../utils/email.ts';
import { asyncHandler } from '../middleware/index.ts';
import { AppError } from '../utils/errors.ts';
import config from '../config/index.ts';

const router = Router();

/**
 * Example route: Send test email
 * 
 * POST /api/email/test
 * Body: { to: string, subject?: string, message?: string }
 */
router.post('/test',
  [
    body('to').isEmail().withMessage('Valid email address is required'),
    body('subject').optional().isString(),
    body('message').optional().isString(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    // Check if email service is enabled
    if (!config.email.enabled) {
      throw new AppError('Email service is not enabled', 503);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(`Validation failed: ${errors.array().map(e => e.msg).join(', ')}`, 400);
    }

    const { to, subject, message } = req.body;

    await EmailService.sendEmail({
      to,
      subject: subject || 'Test Email',
      html: `
        <h1>Test Email</h1>
        <p>${message || 'This is a test email sent from the API server.'}</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `,
      text: message || 'This is a test email sent from the API server.',
    });

    res.status(200).json({
      success: true,
      message: 'Test email sent successfully',
      data: {
        to,
        subject: subject || 'Test Email',
        sentAt: new Date().toISOString(),
      },
    });
  })
);

/**
 * Example route: Send welcome email
 * 
 * POST /api/email/welcome
 * Body: { to: string, name: string }
 */
router.post('/welcome',
  [
    body('to').isEmail().withMessage('Valid email address is required'),
    body('name').notEmpty().withMessage('Name is required'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!config.email.enabled) {
      throw new AppError('Email service is not enabled', 503);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(`Validation failed: ${errors.array().map(e => e.msg).join(', ')}`, 400);
    }

    const { to, name } = req.body;

    await EmailService.sendWelcomeEmail(to, name);

    res.status(200).json({
      success: true,
      message: 'Welcome email sent successfully',
      data: {
        to,
        name,
        sentAt: new Date().toISOString(),
      },
    });
  })
);

export default router;

