// Server startup file
import app from './app.ts';
import config from './config/index.ts';
import logger from './utils/logger.ts';
import { EmailService } from './utils/email.ts';
import { kafkaConsumer } from './services/kafka-consumer.ts';
import { kafkaCompressionConsumer } from './services/kafka-compression-consumer.ts';

// Start server
const server = app.listen(config.port, config.host, async () => {
  logger.info(`Server running on ${config.host}:${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Health check available at: http://${config.host}:${config.port}/api/health`);
  logger.info(`Supabase URL: ${config.supabase.url ? 'configured' : 'not configured'}`);

  // Initialize Email Service
  try {
    if (config.email.enabled) {
      EmailService.initialize();
      const isVerified = await EmailService.verify();
      if (isVerified) {
        logger.info('✅ Email service initialized and verified successfully');
      } else {
        logger.warn('⚠️ Email service initialized but verification failed');
      }
    } else {
      logger.info('Email service is disabled');
    }
  } catch (error) {
    logger.error('❌ Failed to initialize email service', { error });
    logger.warn('Server will continue running, but emails will not be sent');
  }

  // Start Kafka consumer for transcription
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

  // Start Kafka compression consumer
  try {
    logger.info('Starting Kafka compression consumer...');
    await kafkaCompressionConsumer.connect();
    await kafkaCompressionConsumer.subscribe();
    await kafkaCompressionConsumer.start();
    logger.info('✅ Kafka compression consumer started successfully and listening for compression results');
  } catch (error) {
    logger.error('❌ Failed to start Kafka compression consumer', { error });
    logger.warn('Server will continue running, but compression results will not be processed');
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (err: Error, _promise: Promise<any>) => {
  logger.error(`Unhandled Promise Rejection: ${err.message}`);

  // Disconnect Kafka consumers
  try {
    await kafkaConsumer.disconnect();
  } catch (error) {
    logger.error('Error disconnecting Kafka consumer during shutdown', { error });
  }

  try {
    await kafkaCompressionConsumer.disconnect();
  } catch (error) {
    logger.error('Error disconnecting Kafka compression consumer during shutdown', { error });
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

  // Close Email Service
  try {
    EmailService.close();
    logger.info('Email service closed');
  } catch (error) {
    logger.error('Error closing email service', { error });
  }

  // Disconnect Kafka consumers
  try {
    await kafkaConsumer.disconnect();
    logger.info('Kafka consumer disconnected');
  } catch (error) {
    logger.error('Error disconnecting Kafka consumer', { error });
  }

  try {
    await kafkaCompressionConsumer.disconnect();
    logger.info('Kafka compression consumer disconnected');
  } catch (error) {
    logger.error('Error disconnecting Kafka compression consumer', { error });
  }

  server.close(() => {
    logger.info('Process terminated');
  });
});

export default server;