// Kafka Compression Consumer Service
import type { Consumer, EachMessagePayload } from 'kafkajs';
import { kafka } from '../config/kafka.ts';
import config from '../config/index.ts';
import logger from '../utils/logger.ts';
import { VideoService } from './video.ts';

export interface CompressionResult {
  videoId: string;
  cloudUrl: string;
}

class KafkaCompressionConsumerService {
  private consumer: Consumer;
  private isConnected: boolean = false;
  private isRunning: boolean = false;

  constructor() {
    this.consumer = kafka.consumer({
      groupId: 'codeendelea-compression-consumer',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    // Handle consumer events
    this.consumer.on('consumer.connect', () => {
      logger.info('Kafka compression consumer connected');
      this.isConnected = true;
    });

    this.consumer.on('consumer.disconnect', () => {
      logger.warn('Kafka compression consumer disconnected');
      this.isConnected = false;
    });

    this.consumer.on('consumer.crash', (event) => {
      logger.error('Kafka compression consumer crashed', event);
      this.isConnected = false;
      this.isRunning = false;
    });

    // Handle graceful shutdown
    this.setupGracefulShutdown();
  }

  /**
   * Connect to Kafka broker
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('Kafka compression consumer already connected');
      return;
    }

    try {
      await this.consumer.connect();
      logger.info('Kafka compression consumer connected successfully');
      this.isConnected = true;
    } catch (error) {
      logger.error('Failed to connect Kafka compression consumer', { error });
      throw new Error(`Kafka compression consumer connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Subscribe to finish_compress topic
   */
  async subscribe(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    const topic = config.kafka.compressionTopic || 'finish_compress';

    try {
      await this.consumer.subscribe({
        topic: topic,
        fromBeginning: false,
      });

      logger.info('Subscribed to Kafka compression topic', {
        topic: topic,
      });
    } catch (error) {
      logger.error('Failed to subscribe to Kafka compression topic', {
        topic: topic,
        error,
      });
      throw new Error(`Kafka compression subscription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process compression result message
   */
  private async processCompressionResult(result: CompressionResult): Promise<void> {
    try {
      logger.info('Processing compression result', {
        videoId: result.videoId,
        cloudUrl: result.cloudUrl,
      });

      // Update video's camera_video_url with the cloudUrl
      await VideoService.updateCameraVideoUrl(result.videoId, result.cloudUrl);

      logger.info('Compression result processed successfully', {
        videoId: result.videoId,
        cloudUrl: result.cloudUrl,
      });
    } catch (error) {
      logger.error('Error processing compression result', {
        videoId: result.videoId,
        error,
      });
      throw error;
    }
  }

  /**
   * Handle incoming Kafka message
   */
  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    try {
      if (!message.value) {
        logger.warn('Received empty compression message', { topic, partition });
        return;
      }

      // Extract videoId from message key
      const videoId = message.key?.toString();
      if (!videoId) {
        logger.warn('Received compression message without key (videoId)', {
          topic,
          partition,
          offset: message.offset,
        });
        return;
      }

      // Parse value which should be JSON.stringify({ videoId, cloudUrl })
      const messageValue = message.value.toString();
      logger.info('Received Kafka compression message', {
        topic,
        partition,
        offset: message.offset,
        key: videoId,
      });

      let compressionData: { videoId: string; cloudUrl: string };
      try {
        compressionData = JSON.parse(messageValue);
      } catch (parseError) {
        logger.error('Failed to parse compression message value as JSON', {
          topic,
          partition,
          offset: message.offset,
          videoId,
          error: parseError,
          rawValue: messageValue,
        });
        return;
      }

      // Validate required fields
      if (!compressionData.videoId || !compressionData.cloudUrl) {
        logger.error('Compression message missing required fields', {
          topic,
          partition,
          offset: message.offset,
          videoId,
          compressionData,
        });
        return;
      }

      // Use videoId from key as primary source, but also check if it matches value
      if (compressionData.videoId !== videoId) {
        logger.warn('VideoId mismatch between key and value, using key', {
          keyVideoId: videoId,
          valueVideoId: compressionData.videoId,
        });
      }

      // Process the compression result
      await this.processCompressionResult({
        videoId: videoId, // Use videoId from key
        cloudUrl: compressionData.cloudUrl,
      });
    } catch (error) {
      logger.error('Error handling Kafka compression message', {
        topic,
        partition,
        offset: message.offset,
        error,
      });
      // Don't throw - allow consumer to continue processing other messages
    }
  }

  /**
   * Start consuming messages
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.info('Kafka compression consumer already running');
      return;
    }

    await this.subscribe();

    try {
      await this.consumer.run({
        eachMessage: async (payload) => {
          await this.handleMessage(payload);
        },
      });

      this.isRunning = true;
      logger.info('Kafka compression consumer started successfully');
    } catch (error) {
      logger.error('Failed to start Kafka compression consumer', { error });
      throw new Error(`Kafka compression consumer start failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop consuming messages
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.info('Kafka compression consumer already stopped');
      return;
    }

    try {
      await this.consumer.stop();
      this.isRunning = false;
      logger.info('Kafka compression consumer stopped successfully');
    } catch (error) {
      logger.error('Failed to stop Kafka compression consumer', { error });
      throw new Error(`Kafka compression consumer stop failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Disconnect from Kafka broker
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      logger.info('Kafka compression consumer already disconnected');
      return;
    }

    try {
      if (this.isRunning) {
        await this.stop();
      }

      await this.consumer.disconnect();
      logger.info('Kafka compression consumer disconnected successfully');
      this.isConnected = false;
    } catch (error) {
      logger.error('Failed to disconnect Kafka compression consumer', { error });
      throw new Error(`Kafka compression consumer disconnect failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down Kafka compression consumer gracefully...`);
      try {
        await this.disconnect();
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  /**
   * Check consumer status
   */
  getStatus(): { connected: boolean; running: boolean } {
    return {
      connected: this.isConnected,
      running: this.isRunning,
    };
  }
}

// Export singleton instance
export const kafkaCompressionConsumer = new KafkaCompressionConsumerService();
