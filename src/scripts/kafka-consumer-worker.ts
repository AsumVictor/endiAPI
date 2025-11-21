// Kafka Consumer Worker - Run as background service
import { kafkaConsumer } from '../services/kafka-consumer.ts';
import logger from '../utils/logger.ts';

async function startConsumerWorker() {
  logger.info('=== Starting Kafka Consumer Worker ===');

  try {
    // Connect and start consuming
    await kafkaConsumer.connect();
    await kafkaConsumer.subscribe();
    await kafkaConsumer.start();

    logger.info('Kafka consumer worker is running and listening for messages...');
    logger.info('Press Ctrl+C to stop');

    // Keep the process running
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await kafkaConsumer.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await kafkaConsumer.disconnect();
      process.exit(0);
    });

    // Handle uncaught errors
    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught exception in consumer worker', { error });
      await kafkaConsumer.disconnect();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled rejection in consumer worker', { reason, promise });
      await kafkaConsumer.disconnect();
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start Kafka consumer worker', { error });
    process.exit(1);
  }
}

// Start the worker
startConsumerWorker();
