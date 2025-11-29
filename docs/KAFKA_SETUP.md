# Kafka Setup Guide for CodeEndelea API Server

This guide explains how to set up and use Apache Kafka for video transcription processing in the CodeEndelea Learning Management System.

## Overview

The application uses Kafka for asynchronous video transcription processing:
- **Producer**: Sends video transcription requests to the `Transcribe` topic
- **Consumer**: Receives transcription results from the `update_transcribe` topic

## Prerequisites

- Node.js (v18 or higher)
- Access to DigitalOcean Managed Kafka cluster
- Kafka password from DigitalOcean

## Configuration

### 1. Environment Variables

Add the following variables to the `.env` file:

```env
# Kafka Configuration
KAFKA_BROKERS=
KAFKA_USERNAME=
KAFKA_PASSWORD=
KAFKA_PRODUCE_TOPIC=
KAFKA_CONSUME_TOPIC=
KAFKA_SSL=
KAFKA_SASL_MECHANISM=
KAFKA_CONNECTION_TIMEOUT=
KAFKA_REQUEST_TIMEOUT=
```

### 2. SSL Certificate

The Kafka cluster uses **SASL_SSL** authentication which includes:
- **SSL/TLS encryption**: Enabled by default
- **SASL authentication**: Using SCRAM-SHA-256 mechanism
- **Username**: `doadmin`
- **Password**: Kafka password from DigitalOcean

The `kafkajs` library automatically handles SSL certificate validation for DigitalOcean managed Kafka clusters.

## Installation

The required dependency `kafkajs` is already installed:

```bash
npm install kafkajs
```

## Architecture

### Files Structure

```
src/
├── config/
│   ├── index.ts              # Configuration with Kafka settings
│   └── kafka.ts              # Kafka client initialization
├── services/
│   ├── kafka-producer.ts     # Producer service for sending messages
│   └── kafka-consumer.ts     # Consumer service for receiving messages
└── scripts/
    ├── test-kafka.ts         # Connectivity test script
    └── kafka-consumer-worker.ts  # Background consumer worker
```

### Components

#### 1. Kafka Configuration ([src/config/kafka.ts](src/config/kafka.ts))
- Initializes Kafka client with SSL and SASL authentication
- Configures connection timeouts and retry logic
- Exports singleton instance

#### 2. Kafka Producer ([src/services/kafka-producer.ts](src/services/kafka-producer.ts))
**Purpose**: Send video transcription requests

**Methods**:
- `connect()`: Establish connection to Kafka broker
- `sendTranscriptionRequest(request)`: Send transcription request
- `sendMessage(topic, key, value)`: Send generic message
- `disconnect()`: Close connection
- `getConnectionStatus()`: Check connection status

**Usage Example**:
```typescript
import { kafkaProducer } from './services/kafka-producer';

// Send transcription request
await kafkaProducer.sendTranscriptionRequest({
  video_id: 'video-123',
  video_url: 'https://example.com/videos/video-123.mp4',
  metadata: {
    title: 'Introduction to TypeScript',
    courseId: 'course-456',
    userId: 'user-789',
  },
});
```

#### 3. Kafka Consumer ([src/services/kafka-consumer.ts](src/services/kafka-consumer.ts))
**Purpose**: Receive and process transcription results

**Methods**:
- `connect()`: Establish connection to Kafka broker
- `subscribe()`: Subscribe to transcription results topic
- `start()`: Start consuming messages
- `stop()`: Stop consuming messages
- `disconnect()`: Close connection
- `getStatus()`: Check connection and running status

**Message Processing**:
- Automatically processes transcription results
- Updates video records in Supabase database
- Handles errors gracefully without stopping consumer

**Expected Message Format**:
```json
{
  "videoId": "video-123",
  "duration": 120.5,
  "language": "en",
  "words": [
    {
      "word": "hello",
      "start": 0.0,
      "end": 0.5,
      "confidence": 0.98
    }
  ],
  "fullText": "Complete transcription text"
}
```

## Testing

### Test Kafka Connectivity

Run the connectivity test to verify the Kafka setup:

```bash
npm run kafka:test
```

This test will:
1. Connect the producer to Kafka
2. Connect the consumer to Kafka
3. Send a test message to the `Transcribe` topic
4. Subscribe consumer to `update_transcribe` topic
5. Listen for messages for 10 seconds
6. Clean up connections

**Expected Output**:
```
=== Starting Kafka Connectivity Test ===
Test 1: Connecting Kafka Producer...
Producer connection status: CONNECTED
Test 2: Connecting Kafka Consumer...
Consumer connection status: CONNECTED
Test 3: Sending test message...
Test message sent successfully
Test 4: Subscribing consumer to topic...
Consumer subscribed successfully
Test 5: Starting consumer to listen for messages...
Consumer started. Listening for messages for 10 seconds...
=== Kafka Connectivity Test PASSED ===
```

## Running in Production

### Start Consumer Worker

To run the consumer as a background service:

```bash
npm run kafka:consumer
```

This will:
- Connect to Kafka
- Subscribe to `update_transcribe` topic
- Continuously listen for transcription results
- Automatically update video records in database
- Handle graceful shutdown on SIGINT/SIGTERM

**Recommended**: Use a process manager like PM2:

```bash
# Install PM2
npm install -g pm2

# Start consumer with PM2
pm2 start npm --name "kafka-consumer" -- run kafka:consumer

# View logs
pm2 logs kafka-consumer

# Stop consumer
pm2 stop kafka-consumer
```

## Error Handling

### Common Errors and Solutions

#### 1. Connection Timeout
**Error**: `Connection timeout`
**Cause**: Network issues or incorrect broker address
**Solution**:
- Verify `KAFKA_BROKERS` environment variable
- Check network connectivity to DigitalOcean
- Ensure firewall allows outbound connections on port 25073

#### 2. Authentication Failed
**Error**: `Authentication failed` or `SASL authentication error`
**Cause**: Invalid username or password
**Solution**:
- Verify `KAFKA_USERNAME` is set to `doadmin`
- Verify `KAFKA_PASSWORD` matches the DigitalOcean Kafka password
- Ensure `KAFKA_SASL_MECHANISM` is set to `scram-sha-256`

#### 3. SSL/TLS Error
**Error**: `SSL handshake failed`
**Cause**: SSL configuration issue
**Solution**:
- Ensure `KAFKA_SSL=true` in environment variables
- Update Node.js to latest LTS version
- Check system certificates are up to date

#### 4. Topic Not Found
**Error**: `Topic does not exist`
**Cause**: Topics don't exist in Kafka cluster
**Solution**:
- Create topics in DigitalOcean Kafka dashboard:
  - `Transcribe` (producer topic)
  - `update_transcribe` (consumer topic)
- Or enable `allowAutoTopicCreation` (not recommended for production)

## Integration with Video Service

To integrate Kafka with the video service:

```typescript
import { kafkaProducer } from '../services/kafka-producer';

export class VideoService {
  static async requestTranscription(videoId: string, videoUrl: string) {
    // Send video URL to Kafka for transcription
    await kafkaProducer.sendTranscriptionRequest({
      video_id: videoId,
      video_url: videoUrl,
      metadata: {
        // Add any relevant metadata
      },
    });

    // Return immediately (processing happens asynchronously)
    return { success: true, message: 'Transcription request submitted' };
  }
}
```

The consumer will automatically:
1. Receive the transcription result
2. Update the video record in database
3. Log the processing status

## Monitoring

### View Logs

All Kafka operations are logged using Winston logger:

```bash
# View combined logs
tail -f logs/combined.log

# View error logs only
tail -f logs/error.log

# Filter Kafka-specific logs
grep "Kafka" logs/combined.log
```

### Check Consumer Status

The consumer logs key events:
- Connection status
- Messages received
- Processing errors
- Database updates

## Security Best Practices

1. **Never commit credentials**: Keep `.env` file out of version control
2. **Use strong passwords**: Rotate Kafka password regularly
3. **Enable SSL**: Always use SSL/TLS encryption (already configured)
4. **Restrict access**: Use consumer groups to manage access
5. **Monitor logs**: Regularly check logs for authentication failures

## Troubleshooting

### Enable Debug Logging

Set environment variable for detailed Kafka logs:

```env
LOG_LEVEL=debug
```

### Test Individual Components

```typescript
// Test producer only
import { kafkaProducer } from './services/kafka-producer';

await kafkaProducer.connect();
console.log('Status:', kafkaProducer.getConnectionStatus());

// Test consumer only
import { kafkaConsumer } from './services/kafka-consumer';

await kafkaConsumer.connect();
console.log('Status:', kafkaConsumer.getStatus());
```

## Performance Tips

1. **Keep producer connected**: Reuse the same producer instance instead of reconnecting
2. **Consumer groups**: Use consumer groups for horizontal scaling
3. **Batch processing**: Consider batching messages for better throughput
4. **Monitor lag**: Check consumer lag in DigitalOcean dashboard
5. **Adjust timeouts**: Tune timeouts based on network latency

## Additional Resources

- [KafkaJS Documentation](https://kafka.js.org/)
- [DigitalOcean Managed Kafka](https://docs.digitalocean.com/products/kafka/)
- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)

## Support

For issues or questions:
1. Check logs in `logs/` directory
2. Run connectivity test: `npm run kafka:test`
3. Review this documentation
4. Contact DevOps team for Kafka cluster access issues
