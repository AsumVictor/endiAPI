# Message Broker Architecture Overview

This document provides a comprehensive overview of the message broker implementation in the CodeEndelea API Server.

## Overview

The codebase uses **Apache Kafka** (via KafkaJS library) as the message broker for asynchronous processing of video-related tasks. The system implements a publish-subscribe pattern with two main workflows:

1. **Video Transcription Pipeline** - Transcribes video audio to text
2. **Video Compression Pipeline** - Processes video compression results

## Architecture Components

### 1. Kafka Configuration (`src/config/kafka.ts`)

- **Purpose**: Initializes and configures the Kafka client
- **Authentication**: SASL/SCRAM-SHA-256 with SSL/TLS encryption
- **Configuration**:
  - Client ID: `codeendelea-api-server`
  - SSL enabled with self-signed certificate support
  - Connection timeout: 10 seconds (configurable)
  - Request timeout: 30 seconds (configurable)
  - Retry logic: 8 retries with initial retry time of 100ms

**Key Settings**:
```typescript
- SSL/TLS encryption (required)
- SASL mechanism: scram-sha-256
- Broker address from environment variables
- Username/Password authentication
```

### 2. Kafka Producer Service (`src/services/kafka-producer.ts`)

**Purpose**: Sends messages to Kafka topics

**Key Features**:
- Singleton pattern for connection reuse
- Auto-connection on message send
- Connection status tracking
- Event listeners for connection/disconnection
- Graceful error handling

**Main Methods**:
- `connect()` - Establish connection to Kafka broker
- `sendTranscriptionRequest(request)` - Send video transcription request
- `sendMessage(topic, key, value)` - Generic message sending
- `disconnect()` - Close connection gracefully
- `getConnectionStatus()` - Check connection state

**Message Format for Transcription**:
```typescript
{
  video_id: string;
  video_url: string;
  metadata?: {
    title?: string;
    courseId?: string;
    userId?: string;
  };
}
```

**Topic**: `Transcribe` (configurable via `KAFKA_PRODUCE_TOPIC`)

### 3. Kafka Consumer Service (`src/services/kafka-consumer.ts`)

**Purpose**: Consumes transcription results from Kafka

**Key Features**:
- Consumer group: `codeendelea-transcription-consumer`
- Subscribes to: `update_transcribe` topic
- Processes transcription results and updates database
- Automatic Supabase storage integration
- Graceful shutdown handlers (SIGINT, SIGTERM)

**Message Processing Flow**:
1. Receives transcription result message
2. Extracts video ID and transcription data
3. Uploads transcription JSON to Supabase storage (`captions` bucket)
4. Updates video record with `transcript_url`
5. Handles errors without stopping consumer

**Message Format Expected**:
```typescript
{
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
```

**Storage Path**: `videos/{videoId}.json` in `captions` bucket

### 4. Kafka Compression Consumer Service (`src/services/kafka-compression-consumer.ts`)

**Purpose**: Consumes video compression completion messages

**Key Features**:
- Consumer group: `codeendelea-compression-consumer`
- Subscribes to: `finish_compress` topic (configurable)
- Updates video records with compressed video URLs
- Uses video ID as message key

**Message Processing Flow**:
1. Receives compression result with videoId (as key) and cloudUrl (as value)
2. Calls `VideoService.updateCameraVideoUrl()` to update the video record
3. Updates `camera_video_url` field in database

**Message Format Expected**:
```typescript
{
  videoId: string;  // From message key
  cloudUrl: string; // From message value
}
```

**Topic**: `finish_compress` (configurable via `KAFKA_COMPRESSION_TOPIC`)

## Message Flow Diagrams

### Transcription Flow

```
┌─────────────┐         ┌──────────┐         ┌──────────────┐
│ Video Route │────────▶│ Producer │────────▶│ Kafka Topic  │
│  (POST)     │         │ Service  │         │ "Transcribe" │
└─────────────┘         └──────────┘         └──────┬───────┘
                                                     │
                                                     │ (External Service
                                                     │  processes video)
                                                     │
┌─────────────┐         ┌──────────┐         ┌──────▼───────┐
│   Database  │◀────────│ Consumer │◀────────│ Kafka Topic  │
│  (videos)   │         │ Service  │         │"update_trans│
└─────────────┘         └──────────┘         │  cribe"      │
                                             └──────────────┘
```

### Compression Flow

```
┌─────────────┐         ┌──────────┐         ┌──────────────┐
│  External   │────────▶│ Producer │────────▶│ Kafka Topic  │
│ Compression │         │ (Elsewhere)│       │"finish_compr│
│   Service   │         │          │         │   ess"       │
└─────────────┘         └──────────┘         └──────┬───────┘
                                                     │
┌─────────────┐         ┌──────────┐         ┌──────▼───────┐
│   Database  │◀────────│ Consumer │◀────────│   Kafka      │
│  (videos)   │         │ Service  │         │   Topic      │
└─────────────┘         └──────────┘         └──────────────┘
```

## Integration Points

### Producer Usage

The producer is used in `VideoService.createVideo()`:

```typescript
// src/services/video.ts (line ~76)
await kafkaProducer.sendTranscriptionRequest({
  video_id: video.id,
  video_url: video.camera_video_url,
  metadata: {
    title: video.title,
    courseId: courseId,
    userId: userId,
  },
});
```

**When**: Automatically triggered when a new video is created
**Error Handling**: Logs error but doesn't fail video creation (non-blocking)

### Consumer Startup

Both consumers are started in `server.ts` during application startup:

```typescript
// src/server.ts (lines 34-56)
// Transcription Consumer
await kafkaConsumer.connect();
await kafkaConsumer.subscribe();
await kafkaConsumer.start();

// Compression Consumer
await kafkaCompressionConsumer.connect();
await kafkaCompressionConsumer.subscribe();
await kafkaCompressionConsumer.start();
```

**Lifecycle**:
- Started when server starts
- Gracefully disconnected on SIGTERM/SIGINT
- Continues running in background while server is active

## Configuration

### Environment Variables

```env
# Kafka Broker Connection
KAFKA_BROKERS=db-kafka-ams3-04956-do-user-11896611-0.f.db.ondigitalocean.com:25073
KAFKA_USERNAME=doadmin
KAFKA_PASSWORD=your_password_here

# Topics
KAFKA_PRODUCE_TOPIC=Transcribe
KAFKA_CONSUME_TOPIC=update_transcribe
KAFKA_COMPRESSION_TOPIC=finish_compress

# SSL/Security
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=scram-sha-256

# Timeouts
KAFKA_CONNECTION_TIMEOUT=10000
KAFKA_REQUEST_TIMEOUT=30000
```

### Configuration Object

Defined in `src/config/index.ts`:

```typescript
kafka: {
  brokers: string[];
  username: string;
  password: string;
  produceTopic: string;      // "Transcribe"
  consumeTopic: string;      // "update_transcribe"
  compressionTopic: string;  // "finish_compress"
  ssl: boolean;
  saslMechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
  connectionTimeout: number;
  requestTimeout: number;
}
```

## Topics Used

1. **`Transcribe`** (Producer Topic)
   - Purpose: Send video transcription requests
   - Producer: API Server
   - Consumer: External transcription service

2. **`update_transcribe`** (Consumer Topic)
   - Purpose: Receive transcription results
   - Producer: External transcription service
   - Consumer: API Server (`kafkaConsumer`)

3. **`finish_compress`** (Consumer Topic)
   - Purpose: Receive video compression completion notifications
   - Producer: External compression service
   - Consumer: API Server (`kafkaCompressionConsumer`)

## Consumer Groups

- **`codeendelea-transcription-consumer`**: Transcription results consumer
- **`codeendelea-compression-consumer`**: Compression results consumer

**Note**: Consumer groups allow multiple instances to share message load and provide fault tolerance.

## Error Handling

### Producer Errors
- Connection failures are logged but don't block video creation
- Errors are caught and logged with context
- Producer auto-reconnects on next message send

### Consumer Errors
- Individual message processing errors don't stop the consumer
- Errors are logged with full context (topic, partition, offset)
- Consumer continues processing other messages
- Database/storage errors are logged but don't crash the service

### Graceful Shutdown
- Both consumers listen for SIGINT/SIGTERM
- Consumers stop processing, disconnect, then exit
- Handled in both `server.ts` and individual consumer services

## Testing & Scripts

### Available Scripts

```bash
# Test Kafka connectivity
npm run kafka:test

# Test video transcription flow
npm run kafka:test-video

# Check messages in topics
npm run kafka:check-messages

# Run consumer worker (standalone)
npm run kafka:consumer
```

### Test Files

- `src/scripts/test-kafka.ts` - Basic connectivity test
- `src/scripts/test-kafka-video.ts` - Video transcription test
- `src/scripts/check-kafka-messages.ts` - Message inspection
- `src/scripts/kafka-consumer-worker.ts` - Standalone consumer worker

## Security

- **SSL/TLS Encryption**: All connections encrypted
- **SASL Authentication**: SCRAM-SHA-256 mechanism
- **Credentials**: Stored in environment variables (never committed)
- **Self-signed Certificates**: Accepted (for DigitalOcean managed Kafka)

## Monitoring & Logging

All Kafka operations are logged using Winston logger:

- Connection/disconnection events
- Message send/receive events
- Processing errors with full context
- Database update operations

**Log Locations**:
- Combined logs: `logs/combined.log`
- Error logs: `logs/error.log`

**Filter Kafka logs**:
```bash
grep "Kafka" logs/combined.log
```

## Best Practices Implemented

1. ✅ **Singleton Pattern**: Producer and consumers are singletons
2. ✅ **Connection Reuse**: Producer stays connected between requests
3. ✅ **Graceful Shutdown**: Proper cleanup on process termination
4. ✅ **Error Isolation**: Consumer errors don't stop message processing
5. ✅ **Non-blocking Operations**: Producer failures don't block API responses
6. ✅ **Idempotency**: Message processing can handle duplicates
7. ✅ **Logging**: Comprehensive logging for debugging
8. ✅ **Type Safety**: Full TypeScript interfaces for messages

## Dependencies

- **kafkajs**: ^2.2.4 - Kafka client library for Node.js
- Used for both producer and consumer operations

## Related Documentation

- [KAFKA_SETUP.md](KAFKA_SETUP.md) - Complete setup guide
- [KAFKA_QUICK_START.md](KAFKA_QUICK_START.md) - Quick start guide
- [KAFKA_CHECKLIST.md](KAFKA_CHECKLIST.md) - Setup checklist
- [KAFKA_SSL_CERTIFICATE.md](KAFKA_SSL_CERTIFICATE.md) - SSL configuration
- [VIDEO_TRANSCRIPTION_FLOW.md](VIDEO_TRANSCRIPTION_FLOW.md) - Transcription workflow

## Summary

The message broker system provides:
- ✅ Asynchronous video transcription processing
- ✅ Asynchronous video compression result handling
- ✅ Scalable, fault-tolerant architecture
- ✅ Separation of concerns (API server doesn't block on processing)
- ✅ Integration with external services via Kafka
- ✅ Database updates triggered by Kafka events

The implementation follows Kafka best practices and provides a robust foundation for asynchronous video processing workflows.

