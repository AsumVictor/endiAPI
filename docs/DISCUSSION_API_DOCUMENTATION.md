# Discussion/Thread API Documentation

## Overview
This document describes all API endpoints for the discussion/thread system, including request/response structures, required data, and examples.

**Base URL:** `/api/discussions`

**Authentication:** All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

---

## 1. Create Discussion Thread

**Endpoint:** `POST /api/discussions/threads`

**Description:** Student creates a new discussion thread (question) about a video.

**Authentication:** Required (Student role)

### Request Headers
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Request Body
```typescript
{
  video_id: string;              // Required: UUID of the video
  lecturer_id: string;           // Required: UUID of the lecturer who owns the course
  question_text: string;          // Required: The question text (10-5000 characters)
  video_timestamp_seconds?: number;  // Optional: Timestamp in video (non-negative integer)
  code_snippet?: string;         // Optional: Code snippet/highlighted code
}
```

### Request Example
```json
{
  "video_id": "550e8400-e29b-41d4-a716-446655440000",
  "lecturer_id": "660e8400-e29b-41d4-a716-446655440001",
  "question_text": "How do I declare a variable in Python? I tried using 'var' but it didn't work.",
  "video_timestamp_seconds": 120,
  "code_snippet": "x = 10\ny = 20"
}
```

### Response: 201 Created
```json
{
  "success": true,
  "message": "Thread created successfully",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "video_id": "550e8400-e29b-41d4-a716-446655440000",
    "video_timestamp_seconds": 120,
    "student_id": "880e8400-e29b-41d4-a716-446655440003",
    "lecturer_id": "660e8400-e29b-41d4-a716-446655440001",
    "code_snippet": "x = 10\ny = 20",
    "question_text": "How do I declare a variable in Python? I tried using 'var' but it didn't work.",
    "student_unread": false,
    "lecturer_unread": true,
    "status": "open",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### Error Responses

**400 Bad Request** - Validation Error
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "msg": "Question text must be 10-5000 characters",
      "param": "question_text",
      "location": "body"
    }
  ]
}
```

**403 Forbidden** - Not a Student
```json
{
  "success": false,
  "error": "Student profile not found. Only students can create discussion threads."
}
```

**404 Not Found** - Video or Lecturer Not Found
```json
{
  "success": false,
  "error": "Video not found"
}
```

---

## 2. List All Threads

**Endpoint:** `GET /api/discussions/threads`

**Description:** Get all threads where the current user is a participant, optionally filtered.

**Authentication:** Required

### Request Headers
```
Authorization: Bearer <access_token>
```

### Query Parameters (All Optional)
```
video_id: string      // Filter by video ID
course_id: string     // Filter by course ID
status: string        // Filter by status: 'open' or 'resolved'
```

### Request Examples

**Get all threads:**
```
GET /api/discussions/threads
```

**Get threads for a specific video:**
```
GET /api/discussions/threads?video_id=550e8400-e29b-41d4-a716-446655440000
```

**Get open threads for a course:**
```
GET /api/discussions/threads?course_id=990e8400-e29b-41d4-a716-446655440004&status=open
```

### Response: 200 OK
```json
{
  "success": true,
  "message": "Threads retrieved successfully",
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "video_id": "550e8400-e29b-41d4-a716-446655440000",
      "video_timestamp_seconds": 120,
      "student_id": "880e8400-e29b-41d4-a716-446655440003",
      "lecturer_id": "660e8400-e29b-41d4-a716-446655440001",
      "code_snippet": "x = 10\ny = 20",
      "question_text": "How do I declare a variable in Python?",
      "student_unread": false,
      "lecturer_unread": true,
      "status": "open",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

## 3. Get Unread Threads

**Endpoint:** `GET /api/discussions/threads/unread`

**Description:** Get all threads with unread messages for the current user.

**Authentication:** Required

### Request Headers
```
Authorization: Bearer <access_token>
```

### Response: 200 OK
```json
{
  "success": true,
  "message": "Unread threads retrieved successfully",
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "video_id": "550e8400-e29b-41d4-a716-446655440000",
      "video_timestamp_seconds": 120,
      "student_id": "880e8400-e29b-41d4-a716-446655440003",
      "lecturer_id": "660e8400-e29b-41d4-a716-446655440001",
      "code_snippet": null,
      "question_text": "How do I declare a variable in Python?",
      "student_unread": false,
      "lecturer_unread": true,
      "status": "open",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:45:00.000Z"
    }
  ]
}
```

**Note:** 
- For students: Returns threads where `student_unread = true`
- For lecturers: Returns threads where `lecturer_unread = true`

---

## 4. Get Thread by ID

**Endpoint:** `GET /api/discussions/threads/:id`

**Description:** Get a specific thread with all its messages.

**Authentication:** Required (must be a participant)

### Request Headers
```
Authorization: Bearer <access_token>
```

### Path Parameters
```
id: string  // Required: Thread UUID
```

### Request Example
```
GET /api/discussions/threads/770e8400-e29b-41d4-a716-446655440002
```

### Response: 200 OK
```json
{
  "success": true,
  "message": "Thread retrieved successfully",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "video_id": "550e8400-e29b-41d4-a716-446655440000",
    "video_timestamp_seconds": 120,
    "student_id": "880e8400-e29b-41d4-a716-446655440003",
    "lecturer_id": "660e8400-e29b-41d4-a716-446655440001",
    "code_snippet": "x = 10\ny = 20",
    "question_text": "How do I declare a variable in Python?",
    "student_unread": false,
    "lecturer_unread": false,
    "status": "open",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T11:00:00.000Z",
    "messages": [
      {
        "id": "aa0e8400-e29b-41d4-a716-446655440005",
        "thread_id": "770e8400-e29b-41d4-a716-446655440002",
        "author_user_id": "bb0e8400-e29b-41d4-a716-446655440006",
        "content": "How do I declare a variable in Python?",
        "created_at": "2024-01-15T10:30:00.000Z"
      },
      {
        "id": "cc0e8400-e29b-41d4-a716-446655440007",
        "thread_id": "770e8400-e29b-41d4-a716-446655440002",
        "author_user_id": "dd0e8400-e29b-41d4-a716-446655440008",
        "content": "In Python, you don't need to declare variables. Simply assign: x = 10",
        "created_at": "2024-01-15T10:45:00.000Z"
      }
    ]
  }
}
```

### Error Responses

**400 Bad Request** - Invalid Thread ID
```json
{
  "success": false,
  "error": "Thread ID is required"
}
```

**403 Forbidden** - Not a Participant
```json
{
  "success": false,
  "error": "You are not authorized to view this thread"
}
```

**404 Not Found** - Thread Not Found
```json
{
  "success": false,
  "error": "Thread not found"
}
```

---

## 5. Mark Thread as Read

**Endpoint:** `POST /api/discussions/threads/:id/read`

**Description:** Mark a thread as read, clearing the unread flag for the current user.

**Authentication:** Required (must be a participant)

### Request Headers
```
Authorization: Bearer <access_token>
```

### Path Parameters
```
id: string  // Required: Thread UUID
```

### Request Example
```
POST /api/discussions/threads/770e8400-e29b-41d4-a716-446655440002/read
```

### Response: 200 OK
```json
{
  "success": true,
  "message": "Thread marked as read",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "video_id": "550e8400-e29b-41d4-a716-446655440000",
    "video_timestamp_seconds": 120,
    "student_id": "880e8400-e29b-41d4-a716-446655440003",
    "lecturer_id": "660e8400-e29b-41d4-a716-446655440001",
    "code_snippet": null,
    "question_text": "How do I declare a variable in Python?",
    "student_unread": false,
    "lecturer_unread": false,
    "status": "open",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T11:00:00.000Z"
  }
}
```

**Note:** 
- If current user is the student: Sets `student_unread = false`
- If current user is the lecturer: Sets `lecturer_unread = false`

### Error Responses

**400 Bad Request** - Invalid Thread ID
```json
{
  "success": false,
  "error": "Thread ID is required"
}
```

**403 Forbidden** - Not a Participant
```json
{
  "success": false,
  "error": "You are not authorized to mark this thread as read"
}
```

**404 Not Found** - Thread Not Found
```json
{
  "success": false,
  "error": "Thread not found"
}
```

---

## 6. Add Message to Thread

**Endpoint:** `POST /api/discussions/threads/:id/messages`

**Description:** Add a reply message to a discussion thread.

**Authentication:** Required (must be a participant)

### Request Headers
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Path Parameters
```
id: string  // Required: Thread UUID
```

### Request Body
```typescript
{
  content: string;  // Required: Message content (1-5000 characters)
}
```

### Request Example
```json
{
  "content": "In Python, you don't need to declare variables with 'var'. Simply assign a value like: x = 10"
}
```

### Response: 201 Created
```json
{
  "success": true,
  "message": "Message added successfully",
  "data": {
    "id": "cc0e8400-e29b-41d4-a716-446655440007",
    "thread_id": "770e8400-e29b-41d4-a716-446655440002",
    "author_user_id": "dd0e8400-e29b-41d4-a716-446655440008",
    "content": "In Python, you don't need to declare variables with 'var'. Simply assign a value like: x = 10",
    "created_at": "2024-01-15T10:45:00.000Z"
  }
}
```

**Note:** 
- Automatically updates unread flags:
  - If lecturer replies: `student_unread = true`, `lecturer_unread = false`
  - If student replies: `lecturer_unread = true`, `student_unread = false`
- Sends WebSocket notification to the other participant

### Error Responses

**400 Bad Request** - Validation Error
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "msg": "Message content must be 1-5000 characters",
      "param": "content",
      "location": "body"
    }
  ]
}
```

**400 Bad Request** - Invalid Thread ID
```json
{
  "success": false,
  "error": "Thread ID is required"
}
```

**403 Forbidden** - Not a Participant
```json
{
  "success": false,
  "error": "You are not authorized to add messages to this thread"
}
```

**404 Not Found** - Thread Not Found
```json
{
  "success": false,
  "error": "Thread not found"
}
```

---

## Data Models

### DiscussionThread
```typescript
{
  id: string;                      // UUID
  video_id: string;                // UUID - Reference to videos table
  video_timestamp_seconds: number | null;  // Optional: Timestamp in video
  student_id: string;               // UUID - Reference to students table
  lecturer_id: string;             // UUID - Reference to lecturers table
  code_snippet: string | null;     // Optional: Highlighted code
  question_text: string;            // Student's initial question
  student_unread: boolean;          // True if lecturer replied, student hasn't seen
  lecturer_unread: boolean;         // True if student asked, lecturer hasn't seen
  status: 'open' | 'resolved';     // Thread status
  created_at: string;              // ISO 8601 timestamp
  updated_at: string;              // ISO 8601 timestamp
}
```

### DiscussionMessage
```typescript
{
  id: string;                      // UUID
  thread_id: string;               // UUID - Reference to discussion_threads table
  author_user_id: string;          // UUID - Reference to users table
  content: string;                 // Message text
  created_at: string;             // ISO 8601 timestamp
}
```

### ThreadWithMessages
```typescript
DiscussionThread & {
  messages: DiscussionMessage[];   // Array of all messages in the thread
}
```

---

## Validation Rules

### Create Thread
- `video_id`: Required, must be valid UUID
- `lecturer_id`: Required, must be valid UUID
- `question_text`: Required, 10-5000 characters
- `video_timestamp_seconds`: Optional, must be non-negative integer
- `code_snippet`: Optional, string

### Add Message
- `content`: Required, 1-5000 characters

---

## Authorization Rules

### Thread Access
- **Students** can only view threads where they are the `student_id`
- **Lecturers** can only view threads where they are the `lecturer_id`
- Participants can view all messages in their threads

### Thread Creation
- Only **students** can create threads
- Lecturer must own the course for the video

### Message Creation
- Only **participants** (student or lecturer) can add messages to a thread

---

## WebSocket Notifications

When threads or messages are created, WebSocket notifications are sent:

### Thread Created
- **Recipient:** Lecturer
- **Type:** `thread/discussion`
- **Action:** `thread_created`

### Message Added
- **Recipient:** Other participant (student ↔ lecturer)
- **Type:** `thread/discussion`
- **Action:** `message_added`

See [WEBSOCKET_NOTIFICATIONS.md](./WEBSOCKET_NOTIFICATIONS.md) for details.

---

## Example Workflow

### 1. Student Creates Thread
```bash
POST /api/discussions/threads
{
  "video_id": "550e8400-e29b-41d4-a716-446655440000",
  "lecturer_id": "660e8400-e29b-41d4-a716-446655440001",
  "question_text": "How do I declare a variable in Python?",
  "video_timestamp_seconds": 120
}
```

### 2. Lecturer Receives WebSocket Notification
```javascript
socket.on('notification', (notification) => {
  // notification.type === 'thread/discussion'
  // notification.payload.action === 'thread_created'
});
```

### 3. Lecturer Views Thread
```bash
GET /api/discussions/threads/770e8400-e29b-41d4-a716-446655440002
```

### 4. Lecturer Replies
```bash
POST /api/discussions/threads/770e8400-e29b-41d4-a716-446655440002/messages
{
  "content": "In Python, you don't need to declare variables. Simply assign: x = 10"
}
```

### 5. Student Receives WebSocket Notification
```javascript
socket.on('notification', (notification) => {
  // notification.type === 'thread/discussion'
  // notification.payload.action === 'message_added'
});
```

### 6. Student Marks Thread as Read
```bash
POST /api/discussions/threads/770e8400-e29b-41d4-a716-446655440002/read
```

---

## Error Codes Summary

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (not authorized) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Notes

- All timestamps are in ISO 8601 format
- All UUIDs are standard v4 format
- Threads are ordered by `updated_at` (most recent first)
- Messages are ordered by `created_at` (oldest first)
- Unread flags are automatically managed when messages are added
- WebSocket notifications are sent in real-time to connected users

