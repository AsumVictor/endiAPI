# Video Transcription - Quick Reference

## Setup Checklist

### 1. Supabase Storage Setup

- [ ] Create bucket: `captions`
- [ ] Set bucket to **Public**
- [ ] Create folder: `videos` (will be created automatically on first upload)
- [ ] Add storage policies (see below)

### 2. Kafka Setup

- [ ] Consumer running: `npm run kafka:consumer`
- [ ] Topics created: `Transcribe`, `update_transcribe`
- [ ] Kafka credentials configured in `.env`

### 3. Verify Integration

- [ ] Create test video
- [ ] Check logs for "Transcription request sent"
- [ ] Wait for transcription result
- [ ] Verify caption file in storage
- [ ] Check `transcript_url` is updated in database

## Storage Bucket Setup

### Create Bucket in Supabase

1. Go to Supabase Dashboard
2. Navigate to **Storage**
3. Click **New Bucket**
4. Name: `captions`
5. Public: **Yes** ✓
6. Click **Create Bucket**

### Required Storage Policies

```sql
-- 1. Allow public read access
CREATE POLICY "Public read access for captions"
ON storage.objects FOR SELECT
USING (bucket_id = 'captions');

-- 2. Allow service role to upload
CREATE POLICY "Service role upload for captions"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'captions' AND auth.role() = 'authenticated');

-- 3. Allow service role to delete
CREATE POLICY "Service role delete for captions"
ON storage.objects FOR DELETE
USING (bucket_id = 'captions' AND auth.role() = 'authenticated');
```

## File Structure

```
Supabase Storage:
captions/                    ← Bucket
└── videos/                  ← Folder
    ├── video-uuid-1.json    ← Caption files
    ├── video-uuid-2.json
    └── video-uuid-3.json
```

## Flow Summary

```
1. Create Video → 2. Send to Kafka → 3. Transcription Service → 4. Result to Kafka
                                                                           ↓
                                                    5. Consumer receives result
                                                                           ↓
                                               6. Delete old caption (if exists)
                                                                           ↓
                                               7. Upload new caption to storage
                                                                           ↓
                                                 8. Get public URL
                                                                           ↓
                                              9. Update video with caption URL
```

## Key Files

| File | Purpose |
|------|---------|
| [src/services/video.ts](src/services/video.ts) | Sends transcription request on video creation |
| [src/services/kafka-producer.ts](src/services/kafka-producer.ts) | Kafka producer service |
| [src/services/kafka-consumer.ts](src/services/kafka-consumer.ts) | Receives results & uploads to storage |

## Message Formats

### Producer Message (to `Transcribe` topic)

```json
{
  "video_id": "uuid-here",
  "video_url": "https://cdn.example.com/video.mp4",
  "metadata": {
    "title": "Video Title",
    "courseId": "course-uuid",
    "userId": "user-uuid"
  }
}
```

### Consumer Message (from `update_transcribe` topic)

```json
{
  "video_id": "uuid-here",
  "transcription": {
    "duration": 125.5,
    "language": "en",
    "words": [
      {
        "text": "hello",
        "start": 0.0,
        "end": 0.5
      }
    ]
  }
}
```

## Commands

```bash
# Start consumer (development)
npm run kafka:consumer

# Start consumer (production)
pm2 start npm --name "kafka-consumer" -- run kafka:consumer
pm2 save

# View logs
tail -f logs/combined.log | grep -i "transcription\|caption"

# Check consumer status
pm2 list

# Restart consumer
pm2 restart kafka-consumer
```

## Testing

### 1. Create a Test Video

```bash
curl -X POST http://localhost:8000/api/videos/YOUR_COURSE_ID \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Video",
    "description": "Testing transcription",
    "camera_video_url": "https://example.com/test.mp4",
    "level": "beginner",
    "ispublic": true
  }'
```

### 2. Check Logs

```bash
# Should see:
tail -f logs/combined.log

# Expected log entries:
# - "Video sent for transcription"
# - "Transcription request sent to Kafka"
```

### 3. Verify in Supabase

**Storage:**
- Dashboard → Storage → `captions` → `videos` → `{video_id}.json` exists

**Database:**
```sql
SELECT id, title, transcript_url
FROM videos
WHERE id = 'video-id';
```

## Troubleshooting

### Consumer Not Running

```bash
# Check if running
pm2 list

# Start if not running
npm run kafka:consumer

# Check logs for errors
pm2 logs kafka-consumer
```

### Caption Not Uploaded

**Check logs:**
```bash
tail -f logs/error.log | grep -i "caption\|storage"
```

**Common issues:**
- Bucket doesn't exist → Create `captions` bucket
- Insufficient permissions → Check storage policies
- Consumer not running → Start consumer

### transcript_url is NULL

**Possible causes:**
1. Consumer not running
2. Transcription service not responding
3. Storage upload failed

**Debug:**
```bash
# 1. Check consumer is running
pm2 list

# 2. Check logs for errors
tail -f logs/combined.log | grep "Processing transcription result"

# 3. Verify storage bucket exists
# Go to Supabase Dashboard → Storage
```

### Caption File Not Accessible

**Check:**
1. Bucket is **Public**
2. Storage policies allow SELECT
3. URL format is correct

**Test URL:**
```bash
curl https://YOUR_SUPABASE_URL.supabase.co/storage/v1/object/public/captions/videos/video-id.json
```

## Environment Variables

Required in `.env`:

```env
# Kafka
KAFKA_BROKERS=your-kafka-broker-hostname:25073
KAFKA_USERNAME=doadmin
KAFKA_PASSWORD=replace_with_actual_password
KAFKA_PRODUCE_TOPIC=Transcribe
KAFKA_CONSUME_TOPIC=update_transcribe
KAFKA_SSL=true

# Supabase (already configured)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
```

## Monitoring

### Key Metrics to Track

1. **Transcription requests sent**
   ```bash
   grep "Transcription request sent" logs/combined.log | wc -l
   ```

2. **Transcription results processed**
   ```bash
   grep "Transcription result processed successfully" logs/combined.log | wc -l
   ```

3. **Failed uploads**
   ```bash
   grep "Failed to upload caption" logs/error.log
   ```

4. **Storage usage**
   - Check Supabase Dashboard → Storage → `captions` bucket size

## Production Checklist

Before deploying to production:

- [ ] Consumer running with PM2
- [ ] PM2 configured to auto-restart on reboot
- [ ] Supabase `captions` bucket created and public
- [ ] Storage policies configured
- [ ] Kafka credentials secured in `.env`
- [ ] Logs monitored regularly
- [ ] Test transcription flow works end-to-end
- [ ] Error alerts configured
- [ ] Storage quota monitored

## Quick Links

- [Complete Documentation](VIDEO_TRANSCRIPTION_FLOW.md)
- [Kafka Setup](KAFKA_SETUP.md)
- [Kafka Quick Start](KAFKA_QUICK_START.md)

## Support

**Common issues:**
- Consumer crashes → Check logs, restart with `pm2 restart kafka-consumer`
- Storage full → Clean up old captions or increase quota
- Slow processing → Check Kafka lag in DigitalOcean dashboard

**Need help?**
Review [VIDEO_TRANSCRIPTION_FLOW.md](VIDEO_TRANSCRIPTION_FLOW.md) for detailed troubleshooting.
