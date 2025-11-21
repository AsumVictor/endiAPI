// Kafka configuration
import { Kafka } from 'kafkajs';
import config from './index.ts';
import logger from '../utils/logger.ts';

/**
 * Create and configure Kafka client with SSL and SASL authentication
 */
export const createKafkaClient = (): Kafka => {
  if (!config.kafka.brokers.length) {
    throw new Error('Kafka brokers not configured. Please set KAFKA_BROKERS in your .env file');
  }

  if (!config.kafka.username || !config.kafka.password) {
    throw new Error('Kafka credentials not configured. Please set KAFKA_USERNAME and KAFKA_PASSWORD in your .env file');
  }

  const kafka = new Kafka({
    clientId: 'codeendelea-api-server',
    brokers: config.kafka.brokers,
    ssl: {
      rejectUnauthorized: false, // Accept self-signed certificates
    },
    sasl: {
      mechanism: config.kafka.saslMechanism as 'scram-sha-256',
      username: config.kafka.username,
      password: config.kafka.password,
    },
    connectionTimeout: config.kafka.connectionTimeout,
    requestTimeout: config.kafka.requestTimeout,
    retry: {
      initialRetryTime: 100,
      retries: 8,
    },
  });

  logger.info('Kafka client initialized', {
    brokers: config.kafka.brokers,
    saslMechanism: config.kafka.saslMechanism,
    ssl: config.kafka.ssl,
  });

  return kafka;
};

// Export singleton instance
export const kafka = createKafkaClient();
