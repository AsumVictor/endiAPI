# Thread/Discussion API Endpoints Summary

## Base URL
All endpoints are prefixed with `/api/discussions`

---

## 📋 Current Endpoints

### 1. **Create Thread** (Student asks a question)
**`POST /api/discussions/threads`**

**Description:** Students can create a new discussion thread about a video

**Authentication:** Required (Bearer Token)

**Request Body:**
```json
{
  "video_id": "550e8400-e29b-41d4-a716-446655440000",
  "lecturer_id": "660e8400-e29b-41d4-a716-446655440001",
  "question_text": "How do I declare a variable in Python?",
  "video_timestamp_seconds": 120,  // Optional
  "code_snippet": "x = 10\ny = 20"  // Optional
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Thread created successfully",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "video_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "open",
    "lecturer_unread": true,
    "student_unread": false,
    ...
  }
}
```

---

### 2. **List All Threads**
**`GET /api/discussions/threads`**

**Description:** Get all threads where the current user is a participant

**Authentication:** Required (Bearer Token)

**Query Parameters:**
- `video_id` (optional) - Filter by video ID
- `course_id` (optional) - Filter by course ID
- `status` (optional) - Filter by status: `open` or `resolved`

**Example:**
```
GET /api/discussions/threads?status=open&video_id=550e8400-e29b-41d4-a716-446655440000
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Threads retrieved successfully",
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "video_id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "open",
      "question_text": "How do I declare a variable?",
      ...
    }
  ]
}
```

---

### 3. **Get Unread Threads**
**`GET /api/discussions/threads/unread`**

**Description:** Get all threads with unread messages for the current user

**Authentication:** Required (Bearer Token)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Unread threads retrieved successfully",
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "lecturer_unread": true,  // or student_unread: true
      ...
    }
  ]
}
```

---

### 4. **Get Thread by ID** (with messages)
**`GET /api/discussions/threads/{id}`**

**Description:** Get a specific thread with all its messages, including author names and roles

**Authentication:** Required (Bearer Token)

**Path Parameters:**
- `id` - Thread ID (UUID)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Thread retrieved successfully",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "video_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "open",
    "question_text": "How do I declare a variable?",
    "messages": [
      {
        "id": "aa0e8400-e29b-41d4-a716-446655440004",
        "author_user_id": "880e8400-e29b-41d4-a716-446655440003",
        "author_name": "John Doe",
        "author_role": "student",
        "content": "How do I declare a variable in Python?",
        "created_at": "2024-01-15T10:30:00.000Z"
      },
      {
        "id": "bb0e8400-e29b-41d4-a716-446655440005",
        "author_user_id": "dd0e8400-e29b-41d4-a716-446655440008",
        "author_name": "Jane Smith",
        "author_role": "lecturer",
        "content": "In Python, you don't need to declare variables...",
        "created_at": "2024-01-15T10:45:00.000Z"
      }
    ]
  }
}
```

---

### 5. **Mark Thread as Read**
**`POST /api/discussions/threads/{id}/read`**

**Description:** Mark a thread as read, clearing the unread flag for the current user

**Authentication:** Required (Bearer Token)

**Path Parameters:**
- `id` - Thread ID (UUID)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Thread marked as read",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "student_unread": false,
    "lecturer_unread": false,
    ...
  }
}
```

---

### 6. **Add Message to Thread**
**`POST /api/discussions/threads/{id}/messages`**

**Description:** Add a reply message to a discussion thread (student or lecturer can reply)

**Authentication:** Required (Bearer Token)

**Path Parameters:**
- `id` - Thread ID (UUID)

**Request Body:**
```json
{
  "content": "In Python, you don't need to declare variables. Simply assign: x = 10"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Message added successfully",
  "data": {
    "id": "cc0e8400-e29b-41d4-a716-446655440007",
    "thread_id": "770e8400-e29b-41d4-a716-446655440002",
    "author_user_id": "dd0e8400-e29b-41d4-a716-446655440008",
    "content": "In Python, you don't need to declare variables...",
    "created_at": "2024-01-15T10:45:00.000Z"
  }
}
```

---

## ⚠️ Missing Endpoint

### **Resolve Thread** (Not yet implemented)
**`POST /api/discussions/threads/{id}/resolve`** or **`PATCH /api/discussions/threads/{id}`**

**Description:** Mark a thread as resolved (change status from `open` to `resolved`)

**Expected Behavior:**
- Only participants (student or lecturer) can resolve a thread
- Updates `status` field from `'open'` to `'resolved'`
- Updates `updated_at` timestamp
- Optionally sends WebSocket notification

**Proposed Request Body (if using PATCH):**
```json
{
  "status": "resolved"
}
```

**Proposed Response:** `200 OK`
```json
{
  "success": true,
  "message": "Thread resolved successfully",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "status": "resolved",
    "updated_at": "2024-01-15T11:00:00.000Z",
    ...
  }
}
```

---

## 📊 Endpoint Summary Table

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/discussions/threads` | Create new thread | ✅ |
| GET | `/api/discussions/threads` | List all threads | ✅ |
| GET | `/api/discussions/threads/unread` | Get unread threads | ✅ |
| GET | `/api/discussions/threads/{id}` | Get thread with messages | ✅ |
| POST | `/api/discussions/threads/{id}/read` | Mark thread as read | ✅ |
| POST | `/api/discussions/threads/{id}/messages` | Add message to thread | ✅ |
| ~~POST~~ | ~~`/api/discussions/threads/{id}/resolve`~~ | ~~Resolve thread~~ | ❌ **Not implemented** |

---

## 🔐 Authentication

All endpoints require Bearer Token authentication:
```
Authorization: Bearer <access_token>
```

Get access token from:
- `POST /api/auth/login` - Login endpoint
- `GET /api/auth/me` - Returns fresh access token

---

## 📝 Notes

1. **Thread Status:** Threads can be `open` or `resolved`
2. **Unread Flags:** 
   - `student_unread` - True when lecturer replies and student hasn't seen
   - `lecturer_unread` - True when student asks and lecturer hasn't seen
3. **Author Information:** When fetching a thread, messages include `author_name` and `author_role`
4. **WebSocket Notifications:** Real-time notifications are sent when:
   - A new thread is created (notifies lecturer)
   - A new message is added (notifies the other participant)

---

## 🚀 Next Steps

1. **Implement Resolve Thread Endpoint** - Allow participants to mark threads as resolved
2. **Optional: Reopen Thread** - Allow reopening resolved threads
3. **Optional: Delete Thread** - Allow deletion (with proper permissions)
4. **Optional: Edit Message** - Allow editing messages (with time limit)

