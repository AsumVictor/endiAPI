// Server startup file
import app from './app.ts';
import config from './config/index.ts';
import logger from './utils/logger.ts';

// Start server
const server = app.listen(config.port, config.host, () => {
  logger.info(`Server running on ${config.host}:${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Health check available at: http://${config.host}:${config.port}/api/health`);
  logger.info(`Supabase URL: ${config.supabase.url ? 'configured' : 'not configured'}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error, _promise: Promise<any>) => {
  logger.error(`Unhandled Promise Rejection: ${err.message}`);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated');
  });
});

export default server;