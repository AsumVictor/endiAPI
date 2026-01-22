// Main Express application entry point
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Application, Request, Response } from 'express';
import { errorHandler } from './utils/errors.js';
import { corsMiddleware, limiter, requestLogger, securityMiddleware } from './middleware/index.js';
import routes from './routes/index.js';
import { setupSwagger } from './config/swagger.js';

// Get directory paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app: Application = express();

// Security middleware
app.use(securityMiddleware);

// CORS middleware
app.use(corsMiddleware);

// Rate limiting middleware
app.use(limiter);

// Cookie parsing middleware
app.use(cookieParser());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use(requestLogger);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root route - serve animated status page
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Swagger documentation
setupSwagger(app);

// Routes
app.use('/api', routes);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

export default app;