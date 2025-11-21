// Kafka connectivity test script
import { kafkaProducer } from '../services/kafka-producer.ts';
import { kafkaConsumer } from '../services/kafka-consumer.ts';
import logger from '../utils/logger.ts';

async function testKafkaConnectivity() {
  logger.info('=== Starting Kafka Connectivity Test ===');

  try {
    // Test 1: Producer Connection
    logger.info('Test 1: Connecting Kafka Producer...');
    await kafkaProducer.connect();
    const producerStatus = kafkaProducer.getConnectionStatus();
    logger.info(`Producer connection status: ${producerStatus ? 'CONNECTED' : 'DISCONNECTED'}`);

    if (!producerStatus) {
      throw new Error('Producer failed to connect');
    }

    // Test 2: Consumer Connection
    logger.info('Test 2: Connecting Kafka Consumer...');
    await kafkaConsumer.connect();
    const consumerStatus = kafkaConsumer.getStatus();
    logger.info(`Consumer connection status: ${consumerStatus.connected ? 'CONNECTED' : 'DISCONNECTED'}`);

    if (!consumerStatus.connected) {
      throw new Error('Consumer failed to connect');
    }

    // Test 3: Send Test Message
    logger.info('Test 3: Sending test message...');
    const testMessage = {
      video_id: 'test-video-' + Date.now(),
      video_url: 'https://example.com/test-video.mp4',
      metadata: {
        title: 'Test Video',
        courseId: 'test-course-123',
        userId: 'test-user-456',
      },
    };

    await kafkaProducer.sendTranscriptionRequest(testMessage);
    logger.info('Test message sent successfully');

    // Test 4: Subscribe Consumer
    logger.info('Test 4: Subscribing consumer to topic...');
    await kafkaConsumer.subscribe();
    logger.info('Consumer subscribed successfully');

    // Test 5: Start Consumer (run for 10 seconds)
    logger.info('Test 5: Starting consumer to listen for messages...');
    await kafkaConsumer.start();
    logger.info('Consumer started. Listening for messages for 10 seconds...');

    // Wait 10 seconds to receive messages
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Cleanup
    logger.info('Stopping consumer...');
    await kafkaConsumer.disconnect();
    logger.info('Consumer stopped');

    logger.info('Disconnecting producer...');
    await kafkaProducer.disconnect();
    logger.info('Producer disconnected');

    logger.info('=== Kafka Connectivity Test PASSED ===');
    process.exit(0);
  } catch (error) {
    logger.error('=== Kafka Connectivity Test FAILED ===', { error });

    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        logger.error('Connection timeout - check network and broker address');
      } else if (error.message.includes('authentication') || error.message.includes('SASL')) {
        logger.error('Authentication failed - check username and password');
      } else if (error.message.includes('SSL') || error.message.includes('TLS')) {
        logger.error('SSL/TLS error - check SSL configuration');
      } else if (error.message.includes('topic')) {
        logger.error('Topic error - check if topics exist in Kafka cluster');
      }
    }

    // Cleanup on error
    try {
      await kafkaConsumer.disconnect();
      await kafkaProducer.disconnect();
    } catch (cleanupError) {
      logger.error('Error during cleanup', { cleanupError });
    }

    process.exit(1);
  }
}

// Run the test
testKafkaConnectivity();
