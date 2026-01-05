// Azure Service Bus Producer Service
import { serviceBusClient } from '../config/azure-service-bus.ts';
import config from '../config/index.ts';
import logger from '../utils/logger.ts';

export interface TranscriptionJobRequest {
  video_id: string;
  video_url: string;
  metadata?: {
    title?: string;
    courseId?: string;
    userId?: string;
  };
}

export interface VideoCompressionJobRequest {
  video_id: string;
  video_url: string;
  metadata?: {
    title?: string;
    courseId?: string;
  };
}

class AzureServiceBusProducerService {
  /**
   * Send transcription job to Azure Service Bus
   */
  async sendTranscriptionJob(request: TranscriptionJobRequest): Promise<void> {
    const sender = serviceBusClient.createSender(config.serviceBus.transcriptionJobsQueue);
    
    try {
      await sender.sendMessages({
        body: request,
        contentType: 'application/json',
        messageId: `transcription-${request.video_id}-${Date.now()}`,
        subject: 'transcription-job',
      });

      logger.info('Transcription job sent to Azure Service Bus', {
        video_id: request.video_id,
        video_url: request.video_url,
        queue: config.serviceBus.transcriptionJobsQueue,
      });
    } catch (error) {
      logger.error('Failed to send transcription job', {
        video_id: request.video_id,
        error,
      });
      throw new Error(`Failed to send transcription job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await sender.close();
    }
  }

  /**
   * Send video compression job to Azure Service Bus
   */
  async sendVideoCompressionJob(request: VideoCompressionJobRequest): Promise<void> {
    const sender = serviceBusClient.createSender(config.serviceBus.videoCompressionJobsQueue);
    
    try {
      await sender.sendMessages({
        body: request,
        contentType: 'application/json',
        messageId: `compression-${request.video_id}-${Date.now()}`,
        subject: 'video-compression-job',
      });

      logger.info('Video compression job sent to Azure Service Bus', {
        video_id: request.video_id,
        video_url: request.video_url,
        queue: config.serviceBus.videoCompressionJobsQueue,
      });
    } catch (error) {
      logger.error('Failed to send video compression job', {
        video_id: request.video_id,
        error,
      });
      throw new Error(`Failed to send video compression job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await sender.close();
    }
  }

  /**
   * Close (no-op since senders are created per-message)
   */
  async close(): Promise<void> {
    // Senders are created per-message and closed after sending
    // No persistent senders to close
    logger.info('Azure Service Bus producer closed');
  }
}

// Export singleton instance
export const azureServiceBusProducer = new AzureServiceBusProducerService();

