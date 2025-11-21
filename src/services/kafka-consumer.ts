// Kafka Consumer Service
import type { Consumer, EachMessagePayload } from 'kafkajs';
import { kafka } from '../config/kafka.ts';
import config from '../config/index.ts';
import logger from '../utils/logger.ts';
import { supabase } from '../config/database.ts';

export interface TranscriptionResult {
  video_id: string;
  transcription: {
    duration: number;
    language: string;
    words: Array<{
      text: string;
      start: number;
      end: number;
    }>;
  };
}

class KafkaConsumerService {
  private consumer: Consumer;
  private isConnected: boolean = false;
  private isRunning: boolean = false;

  constructor() {
    this.consumer = kafka.consumer({
      groupId: 'codeendelea-transcription-consumer',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    // Handle consumer events
    this.consumer.on('consumer.connect', () => {
      logger.info('Kafka consumer connected');
      this.isConnected = true;
    });

    this.consumer.on('consumer.disconnect', () => {
      logger.warn('Kafka consumer disconnected');
      this.isConnected = false;
    });

    this.consumer.on('consumer.crash', (event) => {
      logger.error('Kafka consumer crashed', event);
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
      logger.info('Kafka consumer already connected');
      return;
    }

    try {
      await this.consumer.connect();
      logger.info('Kafka consumer connected successfully');
      this.isConnected = true;
    } catch (error) {
      logger.error('Failed to connect Kafka consumer', { error });
      throw new Error(`Kafka consumer connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Subscribe to transcription results topic
   */
  async subscribe(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      await this.consumer.subscribe({
        topic: config.kafka.consumeTopic,
        fromBeginning: false,
      });

      logger.info('Subscribed to Kafka topic', {
        topic: config.kafka.consumeTopic,
      });
    } catch (error) {
      logger.error('Failed to subscribe to Kafka topic', {
        topic: config.kafka.consumeTopic,
        error,
      });
      throw new Error(`Kafka subscription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process transcription result message
   */
  private async processTranscriptionResult(result: TranscriptionResult): Promise<void> {
    try {
      logger.info('Processing transcription result', {
        video_id: result.video_id,
        duration: result.transcription.duration,
        language: result.transcription.language,
        wordCount: result.transcription.words?.length || 0,
      });

      const videoId = result.video_id;
      const captionFileName = `${videoId}.json`;
      const storagePath = `videos/${captionFileName}`;

      // Step 1: Check if caption file already exists in storage and delete it
      const { data: existingFiles } = await supabase
        .storage
        .from('captions')
        .list('videos', {
          search: captionFileName,
        });

      if (existingFiles && existingFiles.length > 0) {
        logger.info('Deleting existing caption file', { videoId, storagePath });
        const { error: deleteError } = await supabase
          .storage
          .from('captions')
          .remove([storagePath]);

        if (deleteError) {
          logger.warn('Failed to delete existing caption file', {
            videoId,
            error: deleteError,
          });
        }
      }

      // Step 2: Convert transcription result to JSON and upload to storage
      const captionJson = JSON.stringify(result, null, 2);
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('captions')
        .upload(storagePath, captionJson, {
          contentType: 'application/json',
          upsert: true,
        });

      if (uploadError) {
        logger.error('Failed to upload caption to storage', {
          videoId,
          error: uploadError,
        });
        throw uploadError;
      }

      logger.info('Caption uploaded to storage', {
        videoId,
        path: uploadData.path,
      });

      // Step 3: Get public URL for the uploaded caption
      const { data: publicUrlData } = supabase
        .storage
        .from('captions')
        .getPublicUrl(storagePath);

      const captionPublicUrl = publicUrlData.publicUrl;

      logger.info('Caption public URL generated', {
        videoId,
        url: captionPublicUrl,
      });

      // Step 4: Update video table with caption URL
      const { error: updateError } = await supabase
        .from('videos')
        .update({
          transcript_url: captionPublicUrl,
        })
        .eq('id', videoId);

      if (updateError) {
        logger.error('Failed to update video with caption URL', {
          videoId,
          error: updateError,
        });
        throw updateError;
      }

      logger.info('Transcription result processed successfully', {
        videoId,
        captionUrl: captionPublicUrl,
      });
    } catch (error) {
      logger.error('Error processing transcription result', {
        video_id: result.video_id,
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
        logger.warn('Received empty message', { topic, partition });
        return;
      }

      const messageValue = message.value.toString();
      logger.info('Received Kafka message', {
        topic,
        partition,
        offset: message.offset,
        key: message.key?.toString(),
      });

      // Parse and process transcription result
      const transcriptionResult: TranscriptionResult = JSON.parse(messageValue);
      await this.processTranscriptionResult(transcriptionResult);
    } catch (error) {
      logger.error('Error handling Kafka message', {
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
      logger.info('Kafka consumer already running');
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
      logger.info('Kafka consumer started successfully');
    } catch (error) {
      logger.error('Failed to start Kafka consumer', { error });
      throw new Error(`Kafka consumer start failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop consuming messages
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.info('Kafka consumer already stopped');
      return;
    }

    try {
      await this.consumer.stop();
      this.isRunning = false;
      logger.info('Kafka consumer stopped successfully');
    } catch (error) {
      logger.error('Failed to stop Kafka consumer', { error });
      throw new Error(`Kafka consumer stop failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Disconnect from Kafka broker
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      logger.info('Kafka consumer already disconnected');
      return;
    }

    try {
      if (this.isRunning) {
        await this.stop();
      }

      await this.consumer.disconnect();
      logger.info('Kafka consumer disconnected successfully');
      this.isConnected = false;
    } catch (error) {
      logger.error('Failed to disconnect Kafka consumer', { error });
      throw new Error(`Kafka consumer disconnect failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down Kafka consumer gracefully...`);
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
export const kafkaConsumer = new KafkaConsumerService();
