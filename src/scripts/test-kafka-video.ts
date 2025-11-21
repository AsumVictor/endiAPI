// Test Kafka with actual video
import { kafkaProducer } from '../services/kafka-producer.ts';
import logger from '../utils/logger.ts';

async function testKafkaWithVideo() {
  logger.info('=== Testing Kafka with Actual Video ===');

  try {
    // Connect producer
    logger.info('Connecting Kafka Producer...');
    await kafkaProducer.connect();
    logger.info('✅ Producer connected successfully');

    // Send transcription request with actual video
    const testRequest = {
      video_id: 'e1f5bd7a-9f9e-4629-8fbd-a66a1bec23bb',
      video_url: 'https://res.cloudinary.com/dq3xkuhda/video/upload/v1763678976/y8royhocmf6peqv4t9xq.mp4',
      metadata: {
        title: 'Test Video for Transcription',
        courseId: 'test-course-123',
        userId: 'test-user-456',
      },
    };

    logger.info('Sending transcription request...', {
      video_id: testRequest.video_id,
      video_url: testRequest.video_url,
    });

    await kafkaProducer.sendTranscriptionRequest(testRequest);

    logger.info('✅ Transcription request sent successfully');
    logger.info('Message details:', {
      video_id: testRequest.video_id,
      video_url: testRequest.video_url,
      topic: 'Transcribe',
    });

    // Disconnect
    logger.info('Disconnecting producer...');
    await kafkaProducer.disconnect();
    logger.info('✅ Producer disconnected');

    logger.info('=== Test Completed Successfully ===');
    logger.info('Next steps:');
    logger.info('1. The transcription service should pick up this message');
    logger.info('2. After processing, result will be sent to update_transcribe topic');
    logger.info('3. Consumer will upload caption to Supabase Storage');
    logger.info('4. Video record will be updated with transcript_url');

    process.exit(0);
  } catch (error) {
    logger.error('=== Test Failed ===', { error });

    if (error instanceof Error) {
      logger.error('Error details:', {
        message: error.message,
        stack: error.stack,
      });
    }

    process.exit(1);
  }
}

// Run the test
testKafkaWithVideo();
