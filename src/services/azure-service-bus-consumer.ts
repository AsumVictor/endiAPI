// Azure Service Bus Consumer Service
import { serviceBusClient } from '../config/azure-service-bus.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { VideoService } from './video.js';
import { supabase } from '../config/database.js';
import { QuestionGenerationResultService } from './question-generation-result.js';

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

// Payload types for different job types
export interface VideoCompressionPayload {
  video_id: string;
  compressed_video_url: string;
}

export interface TranscriptionPayload {
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

// Union type for all possible payloads
export type JobResultPayload = VideoCompressionPayload | TranscriptionPayload | Record<string, any>;

export interface JobResultMessage {
  jobId: string;
  job_type: 'video_compression' | 'transcription' | 'question_generation' | string;
  payload: JobResultPayload;
  status: string;
  completionTimestamp: string;
  serverIdentity: string;
}

class AzureServiceBusConsumerService {
  private receiver: ReturnType<typeof serviceBusClient.createReceiver> | null = null;
  private isRunning: boolean = false;

  constructor() {
    // Handle graceful shutdown
    this.setupGracefulShutdown();
  }

  /**
   * Connect and start receiving messages
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.info('Azure Service Bus consumer already running');
      return;
    }

    try {
      // Create receiver for the subscription (topic + subscription)
      this.receiver = serviceBusClient.createReceiver(
        config.serviceBus.jobResultsTopic,
        config.serviceBus.jobResultsSubscription
      );

      logger.info('Azure Service Bus consumer started', {
        topic: config.serviceBus.jobResultsTopic,
        subscription: config.serviceBus.jobResultsSubscription,
      });

      this.isRunning = true;

      // Start receiving messages
      this.receiveMessages();
    } catch (error) {
      logger.error('Failed to start Azure Service Bus consumer', { error });
      throw new Error(`Azure Service Bus consumer start failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Receive and process messages continuously
   */
  private async receiveMessages(): Promise<void> {
    if (!this.receiver) {
      return;
    }

    try {
      // Use subscribe to continuously receive messages
      this.receiver.subscribe({
        processMessage: async (messageReceived) => {
          await this.handleMessage(messageReceived);
        },
        processError: async (error) => {
          logger.error('Error processing Azure Service Bus message', { error });
        },
      });

      logger.info('Azure Service Bus consumer listening for messages...');
    } catch (error) {
      logger.error('Error in receiveMessages', { error });
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(messageReceived: any): Promise<void> {
    try {
      if (!messageReceived.body) {
        logger.warn('Received empty message', {
          messageId: messageReceived.messageId,
        });
        await this.completeMessage(messageReceived);
        return;
      }

      logger.info('Received Azure Service Bus message', {
        messageId: messageReceived.messageId,
        subject: messageReceived.subject,
        contentType: messageReceived.contentType,
      });

      // Parse message body
      let jobResult: JobResultMessage;
      if (typeof messageReceived.body === 'string') {
        jobResult = JSON.parse(messageReceived.body);
      } else if (typeof messageReceived.body === 'object') {
        jobResult = messageReceived.body as JobResultMessage;
      } else {
        logger.error('Unknown message body type', {
          messageId: messageReceived.messageId,
          bodyType: typeof messageReceived.body,
        });
        await this.completeMessage(messageReceived);
        return;
      }

      // Process message based on type
      await this.processJobResult(jobResult);

      // Complete the message to remove it from the subscription
      await this.completeMessage(messageReceived);
    } catch (error) {
      logger.error('Error handling Azure Service Bus message', {
        messageId: messageReceived.messageId,
        error,
      });
      // Don't complete the message on error - it will be retried
    }
  }

  /**
   * Process job result based on job_type
   */
  private async processJobResult(result: JobResultMessage): Promise<void> {
    const jobType = result.job_type;
    const jobTypeNormalized = (jobType || '').trim();
    const _id = result.jobId;

    logger.info('Processing job result', {
      job_type: jobTypeNormalized,
      jobId: _id,
      status: result.status,
    });

    if (jobTypeNormalized === 'video_compression') {
      await this.processVideoCompressionResult(result);
    } else if (jobTypeNormalized === 'transcription') {
      await this.processTranscriptionResult(result);
    } else if (jobTypeNormalized === 'question_generation') {
      await this.processQuestionGenerationResult(result);
    } else {
      logger.warn('Unknown or unhandled job result type', {
        job_type: jobTypeNormalized,
        jobId: _id,
      });
    }
  }


  /**
   * Process transcription result
   */
  private async processTranscriptionResult(result: JobResultMessage): Promise<void> {
    try {
      const videoId = result.jobId;
      const payload = result.payload as TranscriptionPayload;

      if (!videoId) {
        logger.error('Transcription result missing jobId', { result });
        return;
      }

      if (!payload.video_id || !payload.transcription) {
        logger.error('Transcription result missing required fields in payload', {
          videoId,
          payload,
        });
        return;
      }

      // Construct the transcription result object in the format expected by the processing function
      const transcriptionResult: TranscriptionResult = {
        video_id: videoId,
        transcription: payload.transcription,
      };

      logger.info('Processing transcription result', {
        video_id: transcriptionResult.video_id,
        duration: transcriptionResult.transcription.duration,
        language: transcriptionResult.transcription.language,
        wordCount: transcriptionResult.transcription.words?.length || 0,
      });

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
      const captionJson = JSON.stringify(transcriptionResult, null, 2);
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
        videoId: result.jobId,
        error,
      });
      throw error;
    }
  }

  /**
   * Process video compression result
   */
  private async processVideoCompressionResult(result: JobResultMessage): Promise<void> {
    try {
      const videoId = result.jobId;
      const payload = result.payload as VideoCompressionPayload;
      const compressedVideoUrl = payload.compressed_video_url;

      if (!videoId) {
        logger.error('Video compression result missing jobId', { result });
        return;
      }

      if (!compressedVideoUrl) {
        logger.error('Video compression result missing compressed_video_url in payload', {
          videoId,
          payload,
        });
        return;
      }

      logger.info('Processing video compression result', {
        videoId,
        compressedVideoUrl,
        status: result.status,
      });

      // Update video's camera_video_url with the compressed video URL
      await VideoService.updateCameraVideoUrl(videoId, compressedVideoUrl);

      logger.info('Video compression result processed successfully', {
        videoId,
        compressedVideoUrl,
      });
    } catch (error) {
      logger.error('Error processing video compression result', {
        videoId: result.jobId,
        error,
      });
      throw error;
    }
  }

  /**
   * Process question generation result
   */
  private async processQuestionGenerationResult(result: JobResultMessage): Promise<void> {
    await QuestionGenerationResultService.process(result);
  }

  /**
   * Complete message (remove from subscription)
   */
  private async completeMessage(messageReceived: any): Promise<void> {
    try {
      if (this.receiver) {
        await this.receiver.completeMessage(messageReceived);
      }
    } catch (error) {
      logger.error('Error completing message', {
        messageId: messageReceived.messageId,
        error,
      });
    }
  }

  /**
   * Stop consuming messages
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.info('Azure Service Bus consumer already stopped');
      return;
    }

    try {
      if (this.receiver) {
        await this.receiver.close();
        this.receiver = null;
      }
      this.isRunning = false;
      logger.info('Azure Service Bus consumer stopped successfully');
    } catch (error) {
      logger.error('Failed to stop Azure Service Bus consumer', { error });
      throw new Error(`Azure Service Bus consumer stop failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down Azure Service Bus consumer gracefully...`);
      try {
        await this.stop();
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
  getStatus(): { running: boolean } {
    return {
      running: this.isRunning,
    };
  }
}

// Export singleton instance
export const azureServiceBusConsumer = new AzureServiceBusConsumerService();

