// Test script for Azure Service Bus connectivity
import { ServiceBusClient } from '@azure/service-bus';
import { DefaultAzureCredential } from '@azure/identity';
import config from '../config/index.ts';
import logger from '../utils/logger.ts';
import { azureServiceBusProducer } from '../services/azure-service-bus-producer.ts';

async function testAzureServiceBus() {
  logger.info('=== Starting Azure Service Bus Connectivity Test ===');

  try {
    // Test 1: Create Service Bus Client
    logger.info('Test 1: Creating Azure Service Bus client...');
    let client: ServiceBusClient;
    
    if (config.serviceBus.connectionString) {
      client = new ServiceBusClient(config.serviceBus.connectionString);
      logger.info('✅ Service Bus client created with connection string');
    } else if (config.serviceBus.namespace) {
      const fullyQualifiedNamespace = `${config.serviceBus.namespace}.servicebus.windows.net`;
      const credential = new DefaultAzureCredential();
      client = new ServiceBusClient(fullyQualifiedNamespace, credential);
      logger.info('✅ Service Bus client created with passwordless authentication');
    } else {
      throw new Error('No Azure Service Bus connection string or namespace configured');
    }

    // Test 2: Test sending a message to transcription-jobs queue
    logger.info('Test 2: Testing message send to transcription-jobs queue...');
    try {
      await azureServiceBusProducer.sendTranscriptionJob({
        video_id: 'test-video-' + Date.now(),
        video_url: 'https://example.com/test-video.mp4',
        metadata: {
          title: 'Test Video',
        },
      });
      logger.info('✅ Test message sent successfully to transcription-jobs queue');
    } catch (error) {
      logger.error('❌ Failed to send test message', { error });
    }

    // Test 3: Test creating a receiver (subscription)
    logger.info('Test 3: Testing receiver creation for job-results topic...');
    try {
      const receiver = client.createReceiver(
        config.serviceBus.jobResultsTopic,
        config.serviceBus.jobResultsSubscription
      );
      logger.info('✅ Receiver created successfully');
      
      // Close the receiver
      await receiver.close();
    } catch (error) {
      logger.error('❌ Failed to create receiver', { error });
      logger.warn('Note: This might fail if the topic/subscription does not exist');
    }

    // Close the client
    await client.close();
    
    logger.info('=== Azure Service Bus Connectivity Test COMPLETED ===');
  } catch (error) {
    logger.error('=== Azure Service Bus Connectivity Test FAILED ===', { error });
    process.exit(1);
  }
}

// Run the test
testAzureServiceBus().catch((error) => {
  logger.error('Test script error', { error });
  process.exit(1);
});

