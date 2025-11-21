// Kafka Producer Service
import type { Producer } from 'kafkajs';
import { kafka } from '../config/kafka.ts';
import config from '../config/index.ts';
import logger from '../utils/logger.ts';

export interface TranscriptionRequest {
  video_id: string;
  video_url: string;
  metadata?: {
    title?: string;
    courseId?: string;
    userId?: string;
  };
}

class KafkaProducerService {
  private producer: Producer;
  private isConnected: boolean = false;

  constructor() {
    this.producer = kafka.producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 30000,
    });

    // Handle producer errors
    this.producer.on('producer.connect', () => {
      logger.info('Kafka producer connected');
      this.isConnected = true;
    });

    this.producer.on('producer.disconnect', () => {
      logger.warn('Kafka producer disconnected');
      this.isConnected = false;
    });

    this.producer.on('producer.network.request_timeout', (payload) => {
      logger.error('Kafka producer request timeout', payload);
    });
  }

  /**
   * Connect to Kafka broker
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('Kafka producer already connected');
      return;
    }

    try {
      await this.producer.connect();
      logger.info('Kafka producer connected successfully');
      this.isConnected = true;
    } catch (error) {
      logger.error('Failed to connect Kafka producer', { error });
      throw new Error(`Kafka producer connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send transcription request to Kafka
   */
  async sendTranscriptionRequest(request: TranscriptionRequest): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const message = {
        key: request.video_id,
        value: JSON.stringify(request),
        headers: {
          'content-type': 'application/json',
          timestamp: Date.now().toString(),
        },
      };

      const result = await this.producer.send({
        topic: config.kafka.produceTopic,
        messages: [message],
      });

      logger.info('Transcription request sent to Kafka', {
        video_id: request.video_id,
        video_url: request.video_url,
        topic: config.kafka.produceTopic,
        partition: result[0]?.partition,
        offset: result[0]?.baseOffset,
      });
    } catch (error) {
      logger.error('Failed to send transcription request', {
        video_id: request.video_id,
        error,
      });
      throw new Error(`Failed to send Kafka message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send a generic message to a topic
   */
  async sendMessage(topic: string, key: string, value: any): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const message = {
        key,
        value: JSON.stringify(value),
        headers: {
          'content-type': 'application/json',
          timestamp: Date.now().toString(),
        },
      };

      const result = await this.producer.send({
        topic,
        messages: [message],
      });

      logger.info('Message sent to Kafka', {
        topic,
        key,
        partition: result[0]?.partition,
        offset: result[0]?.baseOffset,
      });
    } catch (error) {
      logger.error('Failed to send message to Kafka', { topic, key, error });
      throw new Error(`Failed to send Kafka message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Disconnect from Kafka broker
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      logger.info('Kafka producer already disconnected');
      return;
    }

    try {
      await this.producer.disconnect();
      logger.info('Kafka producer disconnected successfully');
      this.isConnected = false;
    } catch (error) {
      logger.error('Failed to disconnect Kafka producer', { error });
      throw new Error(`Kafka producer disconnect failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if producer is connected
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const kafkaProducer = new KafkaProducerService();
