// Check for messages in update_transcribe topic
import { kafka } from '../config/kafka.ts';
import logger from '../utils/logger.ts';
import config from '../config/index.ts';

async function checkKafkaMessages() {
  logger.info('=== Checking Kafka Messages ===');

  const consumer = kafka.consumer({
    groupId: 'manual-check-' + Date.now(), // Unique group to read all messages
  });

  try {
    // Connect
    await consumer.connect();
    logger.info('✅ Connected to Kafka');

    // Subscribe to update_transcribe topic
    await consumer.subscribe({
      topic: config.kafka.consumeTopic,
      fromBeginning: true, // Read from the beginning to see all messages
    });
    logger.info(`✅ Subscribed to topic: ${config.kafka.consumeTopic}`);

    let messageCount = 0;
    const messages: any[] = [];

    // Run consumer for 10 seconds
    logger.info('Listening for messages for 10 seconds...');

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        messageCount++;
        const value = message.value?.toString();

        logger.info(`Message #${messageCount}:`, {
          topic,
          partition,
          offset: message.offset,
          key: message.key?.toString(),
          timestamp: message.timestamp,
        });

        if (value) {
          try {
            const parsed = JSON.parse(value);
            messages.push(parsed);
            logger.info('Parsed message:', parsed);
          } catch (e) {
            logger.error('Failed to parse message:', value);
          }
        }
      },
    });

    // Wait 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Disconnect
    await consumer.disconnect();

    logger.info('=== Summary ===');
    logger.info(`Total messages found: ${messageCount}`);

    if (messages.length > 0) {
      logger.info('Messages:');
      messages.forEach((msg, idx) => {
        logger.info(`\nMessage ${idx + 1}:`, JSON.stringify(msg, null, 2));
      });
    } else {
      logger.warn('No messages found in topic. Possible reasons:');
      logger.warn('1. Transcription service sent to wrong topic');
      logger.warn('2. Messages not yet published');
      logger.warn('3. Topic name mismatch');
    }

    process.exit(0);
  } catch (error) {
    logger.error('Error:', error);
    await consumer.disconnect();
    process.exit(1);
  }
}

checkKafkaMessages();
