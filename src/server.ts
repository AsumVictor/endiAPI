// Server startup file
import app from './app.ts';
import config from './config/index.ts';
import logger from './utils/logger.ts';
import { kafkaConsumer } from './services/kafka-consumer.ts';

// Start server
const server = app.listen(config.port, config.host, async () => {
  logger.info(`Server running on ${config.host}:${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Health check available at: http://${config.host}:${config.port}/api/health`);
  logger.info(`Supabase URL: ${config.supabase.url ? 'configured' : 'not configured'}`);

  // Start Kafka consumer
  try {
    logger.info('Starting Kafka consumer...');
    await kafkaConsumer.connect();
    await kafkaConsumer.subscribe();
    await kafkaConsumer.start();
    logger.info('✅ Kafka consumer started successfully and listening for transcription results');
  } catch (error) {
    logger.error('❌ Failed to start Kafka consumer', { error });
    logger.warn('Server will continue running, but transcription results will not be processed');
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (err: Error, _promise: Promise<any>) => {
  logger.error(`Unhandled Promise Rejection: ${err.message}`);

  // Disconnect Kafka consumer
  try {
    await kafkaConsumer.disconnect();
  } catch (error) {
    logger.error('Error disconnecting Kafka consumer during shutdown', { error });
  }

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
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');

  // Disconnect Kafka consumer
  try {
    await kafkaConsumer.disconnect();
    logger.info('Kafka consumer disconnected');
  } catch (error) {
    logger.error('Error disconnecting Kafka consumer', { error });
  }

  server.close(() => {
    logger.info('Process terminated');
  });
});

export default server;