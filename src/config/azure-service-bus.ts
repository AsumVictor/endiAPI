// Azure Service Bus configuration
import { ServiceBusClient } from '@azure/service-bus';
import { DefaultAzureCredential } from '@azure/identity';
import config from './index.ts';
import logger from '../utils/logger.ts';

let _serviceBusClient: ServiceBusClient | null = null;

/**
 * Create and configure Azure Service Bus client
 */
export const createServiceBusClient = (): ServiceBusClient => {
  if (_serviceBusClient) {
    return _serviceBusClient;
  }

  // Support both connection string and passwordless authentication
  if (config.serviceBus.connectionString) {
    _serviceBusClient = new ServiceBusClient(config.serviceBus.connectionString);
    logger.info('Azure Service Bus client initialized with connection string', {
      namespace: config.serviceBus.namespace || 'from connection string',
    });
    return _serviceBusClient;
  } else if (config.serviceBus.namespace) {
    // Use passwordless authentication
    const fullyQualifiedNamespace = `${config.serviceBus.namespace}.servicebus.windows.net`;
    const credential = new DefaultAzureCredential();
    _serviceBusClient = new ServiceBusClient(fullyQualifiedNamespace, credential);
    logger.info('Azure Service Bus client initialized with passwordless authentication', {
      namespace: config.serviceBus.namespace,
    });
    return _serviceBusClient;
  } else {
    throw new Error('Azure Service Bus not configured. Please set AZURE_SERVICE_BUS_CONNECTION_STRING or AZURE_SERVICE_BUS_NAMESPACE in your .env file');
  }
};

// Export singleton instance (lazy initialization)
export const serviceBusClient = createServiceBusClient();

