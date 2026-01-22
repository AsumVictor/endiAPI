// Server startup file
import app from './app.js';
import config from './config/index.js';
import logger from './utils/logger.js';
import { EmailService } from './utils/email.js';
import { azureServiceBusConsumer } from './services/azure-service-bus-consumer.js';
import { azureServiceBusProducer } from './services/azure-service-bus-producer.js';
import { webSocketService } from './services/websocket.js';

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

  // Start Azure Service Bus consumer for job results
  try {
    logger.info('Starting Azure Service Bus consumer...');
    await azureServiceBusConsumer.start();
    logger.info('✅ Azure Service Bus consumer started successfully and listening for job results');
  } catch (error) {
      logger.error('❌ Failed to start Azure Service Bus consumer', { error });
      logger.warn('Server will continue running, but job results will not be processed');
    }

    // Initialize WebSocket server for real-time notifications
    try {
      logger.info('Initializing WebSocket server...');
      webSocketService.initialize(server);
      logger.info('✅ WebSocket server initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize WebSocket server', { error });
      logger.warn('Server will continue running, but real-time notifications will not work');
    }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (err: Error, _promise: Promise<any>) => {
  logger.error(`Unhandled Promise Rejection: ${err.message}`);

  // Stop Azure Service Bus consumer
  try {
    await azureServiceBusConsumer.stop();
  } catch (error) {
    logger.error('Error stopping Azure Service Bus consumer during shutdown', { error });
  }

  // Close Azure Service Bus producer
  try {
    await azureServiceBusProducer.close();
  } catch (error) {
    logger.error('Error closing Azure Service Bus producer during shutdown', { error });
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

  // Stop Azure Service Bus consumer
  try {
    await azureServiceBusConsumer.stop();
    logger.info('Azure Service Bus consumer stopped');
  } catch (error) {
    logger.error('Error stopping Azure Service Bus consumer', { error });
  }

  // Close Azure Service Bus producer
  try {
    await azureServiceBusProducer.close();
    logger.info('Azure Service Bus producer closed');
  } catch (error) {
    logger.error('Error closing Azure Service Bus producer', { error });
  }

  // Close WebSocket server
  try {
    webSocketService.close();
    logger.info('WebSocket server closed');
  } catch (error) {
    logger.error('Error closing WebSocket server', { error });
  }

  server.close(() => {
    logger.info('Process terminated');
  });
});

export default server;