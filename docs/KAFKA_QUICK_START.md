# Kafka Quick Start Guide

## 1. Add Kafka Password to .env

```bash
# Copy from env.example if needed
cp env.example .env

# Edit .env and add the Kafka password:
KAFKA_PASSWORD=replace_with_actual_password
```

The following are already configured in `env.example`:
```
KAFKA_BROKERS=
KAFKA_USERNAME=
KAFKA_PRODUCE_TOPIC=
KAFKA_CONSUME_TOPIC=
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=
```

## 2. Test Kafka Connectivity

```bash
npm run kafka:test
```

This will verify:
- ✅ Producer can connect
- ✅ Consumer can connect
- ✅ Messages can be sent
- ✅ Consumer can subscribe and receive messages

## 3. Start Kafka Consumer Worker

```bash
# Run in foreground (development)
npm run kafka:consumer

# OR run in background with PM2 (production)
npm install -g pm2
pm2 start npm --name "kafka-consumer" -- run kafka:consumer
pm2 logs kafka-consumer
```

## 4. Send Transcription Requests (in code)

```typescript
import { kafkaProducer } from './services/kafka-producer';

// Example: Send video for transcription
await kafkaProducer.sendTranscriptionRequest({
  video_id: 'video-uuid-here',
  video_url: 'https://cdn.example.com/videos/video-uuid.mp4',
  metadata: {
    title: 'Course Video Title',
    courseId: 'course-uuid',
    userId: 'user-uuid',
  },
});
```

## 5. Receive Transcription Results

The consumer automatically:
1. Listens to `update_transcribe` topic
2. Receives transcription results
3. Updates video records in Supabase database

Expected result format:
```json
{
  "videoId": "video-uuid",
  "duration": 120.5,
  "language": "en",
  "words": [
    { "word": "hello", "start": 0.0, "end": 0.5, "confidence": 0.98 }
  ],
  "fullText": "Complete transcription"
}
```

## Troubleshooting

**Connection timeout?**
- Check KAFKA_BROKERS is correct
- Verify network/firewall allows port 25073

**Authentication failed?**
- Verify KAFKA_PASSWORD is correct
- Check KAFKA_USERNAME is `doadmin`

**Topic not found?**
- Create topics in DigitalOcean Kafka dashboard:
  - `Transcribe`
  - `update_transcribe`

## Files Created

- [src/config/kafka.ts](src/config/kafka.ts) - Kafka client configuration
- [src/services/kafka-producer.ts](src/services/kafka-producer.ts) - Producer service
- [src/services/kafka-consumer.ts](src/services/kafka-consumer.ts) - Consumer service
- [src/scripts/test-kafka.ts](src/scripts/test-kafka.ts) - Test script
- [src/scripts/kafka-consumer-worker.ts](src/scripts/kafka-consumer-worker.ts) - Background worker
- [KAFKA_SETUP.md](KAFKA_SETUP.md) - Complete documentation

## Next Steps

1. Add the Kafka password to `.env`
2. Run `npm run kafka:test` to verify connectivity
3. Start consumer worker with `npm run kafka:consumer`
4. Integrate producer into the video upload/processing flow

See [KAFKA_SETUP.md](KAFKA_SETUP.md) for detailed documentation.
