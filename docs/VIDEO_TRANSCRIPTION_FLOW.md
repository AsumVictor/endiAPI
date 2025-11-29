# Video Transcription Flow Documentation

This document describes the complete flow for video transcription processing using Kafka and Supabase Storage.

## Overview

When a lecturer creates a video, it's automatically sent for transcription. When the transcription is complete, the caption file is uploaded to Supabase Storage and the video record is updated with the public URL.

## Complete Flow

```
1. Lecturer creates video
   ↓
2. Video saved to database
   ↓
3. Transcription request sent to Kafka (topic: Transcribe)
   ↓
4. External transcription service processes video
   ↓
5. Transcription result sent to Kafka (topic: update_transcribe)
   ↓
6. Consumer receives transcription result
   ↓
7. Check if caption file exists in storage → Delete if exists
   ↓
8. Upload new caption JSON to Supabase Storage
   ↓
9. Get public URL for caption file
   ↓
10. Update video record with caption URL
```

## Step-by-Step Implementation

### Step 1: Video Creation

**File:** [src/services/video.ts](src/services/video.ts#L19-L103)

When a lecturer creates a video:

```typescript
// Create video in database
const { data: video, error } = await supabase
  .from('videos')
  .insert([videoData])
  .select()
  .single();

// Send for transcription via Kafka
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

**Message sent to Kafka topic:** `Transcribe`

**Message format:**
```json
{
  "video_id": "uuid-of-video",
  "video_url": "https://cdn.example.com/videos/video.mp4",
  "metadata": {
    "title": "Introduction to TypeScript",
    "courseId": "course-uuid",
    "userId": "user-uuid"
  }
}
```

### Step 2: Transcription Processing

The external transcription service:
1. Reads messages from `Transcribe` topic
2. Downloads video from `video_url`
3. Processes video and generates transcription
4. Sends result to `update_transcribe` topic

### Step 3: Receiving Transcription Results

**File:** [src/services/kafka-consumer.ts](src/services/kafka-consumer.ts#L103-L205)

The consumer listens to `update_transcribe` topic and receives:

**Expected message format:**
```json
{
  "video_id": "uuid-of-video",
  "transcription": {
    "duration": 125.5,
    "language": "en",
    "words": [
      {
        "text": "hello",
        "start": 0.0,
        "end": 0.5
      },
      {
        "text": "world",
        "start": 0.5,
        "end": 1.0
      }
    ]
  }
}
```

### Step 4: Storage Operations

**Supabase Storage Structure:**
- **Bucket:** `captions`
- **Folder:** `videos`
- **File naming:** `{video_id}.json`
- **Full path:** `videos/{video_id}.json`

**Process:**

1. **Check for existing file:**
   ```typescript
   const { data: existingFiles } = await supabase
     .storage
     .from('captions')
     .list('videos', {
       search: captionFileName,
     });
   ```

2. **Delete existing file if found:**
   ```typescript
   if (existingFiles && existingFiles.length > 0) {
     await supabase
       .storage
       .from('captions')
       .remove([storagePath]);
   }
   ```

3. **Upload new caption file:**
   ```typescript
   const captionJson = JSON.stringify(result, null, 2);
   const { data: uploadData, error: uploadError } = await supabase
     .storage
     .from('captions')
     .upload(storagePath, captionJson, {
       contentType: 'application/json',
       upsert: true,
     });
   ```

4. **Get public URL:**
   ```typescript
   const { data: publicUrlData } = supabase
     .storage
     .from('captions')
     .getPublicUrl(storagePath);

   const captionPublicUrl = publicUrlData.publicUrl;
   ```

### Step 5: Update Database

**Update video record with caption URL:**

```typescript
const { error: updateError } = await supabase
  .from('videos')
  .update({
    transcript_url: captionPublicUrl,
  })
  .eq('id', videoId);
```

**Result:**
The `videos` table now has the public URL to the caption file in the `transcript_url` column.

## Supabase Storage Configuration

### Required Storage Bucket

Create a storage bucket in Supabase:

**Bucket Name:** `captions`

**Settings:**
- **Public:** Yes (so URLs are publicly accessible)
- **File size limit:** 10MB (captions are usually small)
- **Allowed MIME types:** `application/json`

**Folder Structure:**
```
captions/
└── videos/
    ├── video-uuid-1.json
    ├── video-uuid-2.json
    └── video-uuid-3.json
```

### How to Create the Bucket

1. Go to Supabase Dashboard
2. Navigate to **Storage**
3. Click **New Bucket**
4. Enter name: `captions`
5. Set to **Public**
6. Click **Create Bucket**

### Storage Policies

Add these RLS policies for the `captions` bucket:

**Policy 1: Public Read Access**
```sql
-- Allow anyone to read caption files
CREATE POLICY "Public read access for captions"
ON storage.objects FOR SELECT
USING (bucket_id = 'captions');
```

**Policy 2: Authenticated Upload**
```sql
-- Allow authenticated users (service role) to upload
CREATE POLICY "Authenticated upload for captions"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'captions' AND auth.role() = 'authenticated');
```

**Policy 3: Authenticated Delete**
```sql
-- Allow authenticated users (service role) to delete
CREATE POLICY "Authenticated delete for captions"
ON storage.objects FOR DELETE
USING (bucket_id = 'captions' AND auth.role() = 'authenticated');
```

## Example Usage

### Creating a Video (Lecturer)

**Endpoint:** `POST /api/videos/:courseId`

```typescript
// Request
POST /api/videos/course-123
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "title": "Introduction to TypeScript",
  "description": "Learn TypeScript basics",
  "camera_video_url": "https://cdn.example.com/videos/typescript-intro.mp4",
  "thumbnail_url": "https://cdn.example.com/thumbnails/typescript.jpg",
  "level": "beginner",
  "ispublic": true
}

// Response
{
  "success": true,
  "message": "Video created successfully and sent for transcription",
  "data": {
    "id": "video-uuid-123",
    "title": "Introduction to TypeScript",
    "camera_video_url": "https://cdn.example.com/videos/typescript-intro.mp4",
    "transcript_url": null,  // Will be updated after transcription
    "created_at": "2025-01-20T10:00:00Z"
  }
}
```

### Accessing Video with Captions (Student)

**Endpoint:** `GET /api/videos/:videoId`

After transcription is complete:

```typescript
// Request
GET /api/videos/video-uuid-123
Authorization: Bearer <jwt_token>

// Response
{
  "success": true,
  "message": "Video retrieved successfully",
  "data": {
    "id": "video-uuid-123",
    "title": "Introduction to TypeScript",
    "camera_video_url": "https://cdn.example.com/videos/typescript-intro.mp4",
    "transcript_url": "https://xxzeaovewnmfvmekvhvm.supabase.co/storage/v1/object/public/captions/videos/video-uuid-123.json",
    "lecturer": {
      "first_name": "John",
      "last_name": "Doe"
    },
    "course": {
      "id": "course-123",
      "name": "TypeScript Masterclass"
    }
  }
}
```

### Fetching Caption Data

The student's video player can fetch the caption JSON:

```typescript
// Fetch caption from public URL
const response = await fetch('https://xxzeaovewnmfvmekvhvm.supabase.co/storage/v1/object/public/captions/videos/video-uuid-123.json');
const captionData = await response.json();

// Caption data structure
{
  "video_id": "video-uuid-123",
  "duration": 125.5,
  "language": "en",
  "words": [
    {
      "word": "hello",
      "start": 0.0,
      "end": 0.5,
      "confidence": 0.98
    }
  ],
  "fullText": "Complete transcription..."
}
```

## Monitoring and Logs

### Key Log Events

1. **Video Creation:**
   ```
   Video sent for transcription { videoId: 'video-uuid-123' }
   ```

2. **Transcription Request Sent:**
   ```
   Transcription request sent to Kafka {
     video_id: 'video-uuid-123',
     video_url: 'https://...',
     topic: 'Transcribe'
   }
   ```

3. **Transcription Result Received:**
   ```
   Processing transcription result {
     video_id: 'video-uuid-123',
     duration: 125.5,
     language: 'en',
     wordCount: 245
   }
   ```

4. **Storage Operations:**
   ```
   Deleting existing caption file { videoId: 'video-uuid-123', storagePath: 'videos/video-uuid-123.json' }
   Caption uploaded to storage { videoId: 'video-uuid-123', path: 'videos/video-uuid-123.json' }
   Caption public URL generated { videoId: 'video-uuid-123', url: 'https://...' }
   ```

5. **Database Update:**
   ```
   Transcription result processed successfully {
     videoId: 'video-uuid-123',
     captionUrl: 'https://...'
   }
   ```

### View Logs

```bash
# All logs
tail -f logs/combined.log

# Only transcription-related logs
tail -f logs/combined.log | grep -i "transcription\|caption"

# Only errors
tail -f logs/error.log
```

## Error Handling

### Video Creation Fails to Send to Kafka

**Behavior:** Video is still created, but transcription isn't requested.

**Log:**
```
Failed to send video for transcription {
  videoId: 'video-uuid-123',
  error: { ... }
}
```

**Solution:** Manually retry sending to Kafka or implement a retry mechanism.

### Storage Upload Fails

**Behavior:** Transcription result is processed but not saved to storage.

**Log:**
```
Failed to upload caption to storage {
  videoId: 'video-uuid-123',
  error: { ... }
}
```

**Common Causes:**
- Storage bucket doesn't exist
- Insufficient permissions
- Network issues

**Solution:**
1. Verify `captions` bucket exists
2. Check storage policies
3. Review Supabase service key permissions

### Database Update Fails

**Behavior:** Caption is uploaded but video record isn't updated.

**Log:**
```
Failed to update video with caption URL {
  videoId: 'video-uuid-123',
  error: { ... }
}
```

**Solution:** Manually update the video record with the caption URL.

## Testing

### Test the Complete Flow

1. **Start the consumer:**
   ```bash
   npm run kafka:consumer
   ```

2. **Create a test video:**
   ```bash
   curl -X POST http://localhost:8000/api/videos/course-123 \
     -H "Authorization: Bearer YOUR_JWT" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Test Video",
       "description": "Testing transcription flow",
       "camera_video_url": "https://example.com/test.mp4",
       "level": "beginner"
     }'
   ```

3. **Check logs for transcription request:**
   ```bash
   tail -f logs/combined.log | grep "Transcription request sent"
   ```

4. **Simulate transcription result** (for testing):
   ```typescript
   // Manually send a test result to update_transcribe topic
   await kafkaProducer.sendMessage('update_transcribe', 'test-video-id', {
     video_id: 'video-uuid-123',
     duration: 60.0,
     language: 'en',
     words: [
       { word: 'test', start: 0.0, end: 0.5, confidence: 0.99 }
     ],
     fullText: 'This is a test transcription'
   });
   ```

5. **Verify in logs:**
   ```bash
   tail -f logs/combined.log | grep "Transcription result processed"
   ```

6. **Check Supabase Storage:**
   - Go to Supabase Dashboard → Storage → `captions` bucket
   - Navigate to `videos` folder
   - Verify `{video_id}.json` exists

7. **Verify database:**
   ```sql
   SELECT id, title, transcript_url
   FROM videos
   WHERE id = 'video-uuid-123';
   ```

## Best Practices

1. **Always check if caption exists before uploading** - Prevents duplicate files
2. **Use upsert: true when uploading** - Allows overwriting if delete fails
3. **Log all steps** - Makes debugging easier
4. **Don't fail video creation if Kafka fails** - Video creation should succeed independently
5. **Handle partial failures gracefully** - Log errors but continue processing
6. **Monitor storage quota** - Captions accumulate over time
7. **Set appropriate retention policies** - Clean up old captions if needed

## Troubleshooting

### Caption URL is null after transcription

**Check:**
1. Consumer is running: `pm2 list`
2. Transcription result was received: Check logs
3. Storage bucket exists: Supabase Dashboard → Storage
4. Upload succeeded: Check logs for upload errors

### Caption file not accessible

**Check:**
1. Bucket is public
2. Storage policies allow public read
3. URL is correct format
4. File exists in storage

### Duplicate caption files

**Cause:** Delete operation failed but upload succeeded

**Solution:** The code uses `upsert: true` which overwrites existing files

## Summary

This implementation provides a complete, automated flow for video transcription:

✅ **Automatic**: Transcription starts when video is created
✅ **Reliable**: Error handling at each step
✅ **Scalable**: Uses Kafka for async processing
✅ **Accessible**: Caption files are publicly accessible via URL
✅ **Maintainable**: Comprehensive logging for debugging

The video player can fetch caption data from the public URL and display subtitles in real-time!
