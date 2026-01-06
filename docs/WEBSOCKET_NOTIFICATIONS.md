# WebSocket Notifications Documentation

## Overview
This API server uses **Socket.IO** for real-time WebSocket notifications. Clients can connect to receive instant notifications for various events like thread discussions, user management, course updates, and more.

---

## 1. WebSocket Connection

### Server Endpoint
```
ws://localhost:8000/socket.io
```
(Replace `localhost:8000` with your server host and port)

### Connection Requirements
- **Authentication:** JWT access token required
- **Protocol:** Socket.IO (WebSocket with fallback)
- **Path:** `/socket.io` (default Socket.IO path)

### Client Connection Example

```javascript
import io from 'socket.io-client';

// Connect with authentication
const socket = io('http://localhost:8000', {
  auth: {
    token: accessToken  // JWT access_token from /api/auth/login
  },
  // OR use Authorization header:
  // extraHeaders: {
  //   Authorization: `Bearer ${accessToken}`
  // }
});

// Connection event handlers
socket.on('connect', () => {
  console.log('✅ Connected to WebSocket server');
  console.log('Socket ID:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
  // Usually authentication failure
});
```

---

## 2. Authentication

### Token Format
The WebSocket connection requires the same JWT `access_token` returned from the login endpoint:

```javascript
// After login
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});

const { data } = await loginResponse.json();
const accessToken = data.tokens.access_token;

// Use this token for WebSocket connection
const socket = io('http://localhost:8000', {
  auth: { token: accessToken }
});
```

### Authentication Errors
If authentication fails, the connection will be rejected with an error:
- `"Authentication required"` - No token provided
- `"Invalid token"` - Token is invalid or expired
- `"Authentication failed"` - Token verification error

---

## 3. Receiving Notifications

### Notification Event
All notifications are sent via the `'notification'` event:

```javascript
socket.on('notification', (notification) => {
  console.log('New notification received:', notification);
  
  // Handle based on notification type
  switch (notification.type) {
    case 'thread/discussion':
      handleThreadNotification(notification);
      break;
    case 'user/created':
      handleUserCreatedNotification(notification);
      break;
    // ... other types
  }
});
```

### Notification Object Structure

```typescript
interface Notification {
  id: string;                    // Unique notification ID (UUID)
  type: NotificationType;        // Notification category
  payload: NotificationPayload;  // Type-specific payload
  timestamp: string;             // ISO 8601 timestamp
  read: boolean;                 // Always false for new notifications
}
```

---

## 4. Thread/Discussion Notifications

### Notification Type
```typescript
type: 'thread/discussion'
```

### Payload Structure
```typescript
interface ThreadDiscussionPayload {
  action: 'thread_created' | 'message_added' | 'thread_read' | 'thread_resolved';
  threadId: string;              // UUID of the discussion thread
  videoId?: string;              // UUID of the video
  videoTitle?: string;           // Title of the video
  questionPreview?: string;       // First 150 chars of question (for thread_created)
  messagePreview?: string;        // First 150 chars of message (for message_added)
  authorName?: string;            // Name of the person who created thread/message
  timestamp: string;              // ISO 8601 timestamp
}
```

### Example: Thread Created

**When:** Student creates a new discussion thread  
**Recipient:** Lecturer who owns the course

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "thread/discussion",
  "payload": {
    "action": "thread_created",
    "threadId": "thread-uuid-123",
    "videoId": "video-uuid-456",
    "videoTitle": "Introduction to Python Variables",
    "questionPreview": "How do I declare a variable in Python? I tried using var but it didn't work...",
    "authorName": "John Doe",
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "read": false
}
```

**Client Handler:**
```javascript
socket.on('notification', (notification) => {
  if (notification.type === 'thread/discussion') {
    const { action, threadId, videoTitle, questionPreview, authorName } = notification.payload;
    
    if (action === 'thread_created') {
      // Show notification badge
      updateNotificationBadge();
      
      // Display notification toast
      showNotificationToast({
        title: 'New Question',
        message: `${authorName} asked: ${questionPreview}`,
        video: videoTitle
      });
      
      // Update unread threads list
      fetchUnreadThreads();
    }
  }
});
```

### Example: Message Added

**When:** Participant replies to a thread  
**Recipient:** The other participant (student ↔ lecturer)

```json
{
  "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "type": "thread/discussion",
  "payload": {
    "action": "message_added",
    "threadId": "thread-uuid-123",
    "videoId": "video-uuid-456",
    "videoTitle": "Introduction to Python Variables",
    "messagePreview": "In Python, you don't need to declare variables with 'var'. Simply assign a value like: x = 10",
    "authorName": "Dr. Jane Smith",
    "timestamp": "2024-01-15T10:45:00.000Z"
  },
  "timestamp": "2024-01-15T10:45:00.000Z",
  "read": false
}
```

**Client Handler:**
```javascript
socket.on('notification', (notification) => {
  if (notification.type === 'thread/discussion') {
    const { action, threadId, messagePreview, authorName } = notification.payload;
    
    if (action === 'message_added') {
      // Update thread if currently open
      if (currentThreadId === threadId) {
        refreshThreadMessages();
      } else {
        // Show notification badge
        updateNotificationBadge();
        
        // Show notification toast
        showNotificationToast({
          title: 'New Reply',
          message: `${authorName}: ${messagePreview}`,
          onClick: () => openThread(threadId)
        });
      }
    }
  }
});
```

---

## 5. Complete Client Example

```javascript
import io from 'socket.io-client';

class NotificationService {
  constructor(accessToken) {
    this.socket = io('http://localhost:8000', {
      auth: { token: accessToken }
    });
    
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      // Attempt reconnection
      if (reason === 'io server disconnect') {
        this.socket.connect();
      }
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      // Handle authentication errors
      if (error.message.includes('Authentication')) {
        // Refresh token and reconnect
        this.refreshTokenAndReconnect();
      }
    });
    
    // Notification handler
    this.socket.on('notification', (notification) => {
      this.handleNotification(notification);
    });
    
    // Ping/pong for keep-alive
    this.socket.on('pong', () => {
      console.log('Pong received');
    });
  }
  
  handleNotification(notification) {
    console.log('Received notification:', notification);
    
    switch (notification.type) {
      case 'thread/discussion':
        this.handleThreadNotification(notification);
        break;
      case 'user/created':
        this.handleUserCreatedNotification(notification);
        break;
      // Add more handlers as needed
      default:
        console.warn('Unknown notification type:', notification.type);
    }
  }
  
  handleThreadNotification(notification) {
    const { action, threadId, videoTitle, questionPreview, messagePreview, authorName } = notification.payload;
    
    switch (action) {
      case 'thread_created':
        // Update UI
        this.updateNotificationBadge();
        this.showToast({
          type: 'info',
          title: 'New Question',
          message: `${authorName} asked a question about "${videoTitle}"`,
          preview: questionPreview
        });
        break;
        
      case 'message_added':
        // Update UI
        this.updateNotificationBadge();
        this.showToast({
          type: 'info',
          title: 'New Reply',
          message: `${authorName} replied`,
          preview: messagePreview,
          onClick: () => this.openThread(threadId)
        });
        break;
    }
  }
  
  // Helper methods
  updateNotificationBadge() {
    // Update badge count in UI
    fetch('/api/discussions/threads/unread')
      .then(res => res.json())
      .then(data => {
        const count = data.data.length;
        document.getElementById('notification-badge').textContent = count;
      });
  }
  
  showToast(options) {
    // Show browser notification or in-app toast
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(options.title, {
        body: options.message,
        icon: '/icon.png'
      });
    }
    
    // Also show in-app notification
    // ... your toast implementation
  }
  
  openThread(threadId) {
    // Navigate to thread
    window.location.href = `/discussions/threads/${threadId}`;
  }
  
  disconnect() {
    this.socket.disconnect();
  }
}

// Usage
const notificationService = new NotificationService(accessToken);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  notificationService.disconnect();
});
```

---

## 6. Notification Types Reference

### Available Notification Types

| Type | Description | Payload Interface |
|------|-------------|-------------------|
| `thread/discussion` | Thread and message notifications | `ThreadDiscussionPayload` |
| `user/created` | User account created | `UserCreatedPayload` |
| `user/deleted` | User account deleted | `UserDeletedPayload` |
| `course/created` | New course created | `CourseCreatedPayload` |
| `video/uploaded` | Video uploaded to course | `VideoUploadedPayload` |

### Thread/Discussion Actions

| Action | Description | When Sent |
|--------|-------------|-----------|
| `thread_created` | New discussion thread created | Student creates a question |
| `message_added` | New message in thread | Participant replies |
| `thread_read` | Thread marked as read | (Not yet implemented) |
| `thread_resolved` | Thread marked as resolved | (Not yet implemented) |

---

## 7. Connection Management

### Reconnection
Socket.IO automatically handles reconnection. You can configure it:

```javascript
const socket = io('http://localhost:8000', {
  auth: { token: accessToken },
  reconnection: true,        // Enable auto-reconnect (default: true)
  reconnectionDelay: 1000,  // Wait 1s before reconnect
  reconnectionDelayMax: 5000, // Max 5s delay
  reconnectionAttempts: Infinity // Retry forever
});
```

### Manual Reconnection
```javascript
// Disconnect
socket.disconnect();

// Reconnect
socket.connect();
```

### Connection Status
```javascript
socket.on('connect', () => {
  console.log('Connected:', socket.connected); // true
});

socket.on('disconnect', () => {
  console.log('Connected:', socket.connected); // false
});
```

---

## 8. Error Handling

### Common Errors

**Authentication Failed:**
```javascript
socket.on('connect_error', (error) => {
  if (error.message.includes('Authentication')) {
    // Token expired or invalid
    // Refresh token and reconnect
    refreshAccessToken().then(newToken => {
      socket.auth.token = newToken;
      socket.connect();
    });
  }
});
```

**Connection Lost:**
```javascript
socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    // Server disconnected, reconnect manually
    socket.connect();
  } else if (reason === 'transport close') {
    // Connection lost, will auto-reconnect
    console.log('Connection lost, reconnecting...');
  }
});
```

---

## 9. Testing WebSocket Connection

### Browser Console Test

```javascript
// 1. Get access token (after login)
const token = 'your-jwt-access-token';

// 2. Connect
const socket = io('http://localhost:8000', {
  auth: { token }
});

// 3. Listen for notifications
socket.on('notification', (notification) => {
  console.log('Notification:', notification);
});

// 4. Test ping
socket.emit('ping');
socket.on('pong', () => console.log('Pong received'));

// 5. Check connection
console.log('Connected:', socket.connected);
console.log('Socket ID:', socket.id);
```

---

## 10. Best Practices

### 1. Store Access Token Securely
```javascript
// Use secure storage (not localStorage for sensitive apps)
const token = localStorage.getItem('access_token');
```

### 2. Handle Token Refresh
```javascript
// Refresh token before it expires
socket.on('connect_error', async (error) => {
  if (error.message.includes('Invalid token')) {
    const newToken = await refreshAccessToken();
    socket.auth.token = newToken;
    socket.connect();
  }
});
```

### 3. Clean Up on Unmount
```javascript
// React example
useEffect(() => {
  const socket = io('http://localhost:8000', { auth: { token } });
  
  return () => {
    socket.disconnect();
  };
}, [token]);
```

### 4. Handle Multiple Tabs
Socket.IO automatically handles multiple connections from the same user. Each tab/device will receive notifications independently.

### 5. Show Connection Status
```javascript
socket.on('connect', () => {
  showConnectionStatus('connected');
});

socket.on('disconnect', () => {
  showConnectionStatus('disconnected');
});
```

---

## 11. Server Configuration

### Port
The WebSocket server runs on the same port as the HTTP server (default: 8000, configurable via `PORT` env variable).

### CORS
WebSocket CORS is configured via `CORS_ORIGIN` environment variable.

### Path
Default Socket.IO path: `/socket.io` (configurable in server code).

---

## 12. Troubleshooting

### Connection Fails
1. Check server is running on correct port
2. Verify access token is valid and not expired
3. Check CORS configuration
4. Verify network/firewall settings

### Not Receiving Notifications
1. Verify connection is established (`socket.connected === true`)
2. Check you're listening to `'notification'` event
3. Verify user is the intended recipient
4. Check server logs for notification sending errors

### Authentication Errors
1. Ensure token is passed in `auth.token` or `Authorization` header
2. Verify token hasn't expired
3. Check token format (should be JWT)

---

## 13. API Integration

Notifications complement the REST API. Use both together:

```javascript
// REST API: Get unread threads
const response = await fetch('/api/discussions/threads/unread', {
  headers: { Authorization: `Bearer ${token}` }
});
const { data: threads } = await response.json();

// WebSocket: Listen for new notifications
socket.on('notification', (notification) => {
  if (notification.type === 'thread/discussion') {
    // Update UI with new notification
    // Optionally refresh unread threads list
    refreshUnreadThreads();
  }
});
```

---

## Summary

- **Endpoint:** `ws://localhost:8000/socket.io`
- **Auth:** JWT access_token in `auth.token`
- **Event:** Listen to `'notification'` event
- **Thread/Discussion:** Type `'thread/discussion'` with actions `thread_created`, `message_added`
- **Auto-reconnect:** Enabled by default
- **Multi-device:** Supported (same user, multiple connections)

For thread/discussion specific payloads, see the `ThreadDiscussionPayload` structure in section 4.

