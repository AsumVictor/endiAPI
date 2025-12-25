# Authentication System Documentation

## Overview

The CodeEndelea LMS API includes a comprehensive authentication system built with Supabase Auth and JWT tokens. This system provides secure user registration, login, token management, and role-based access control.

## Features

- ✅ User Registration
- ✅ User Login
- ✅ JWT Access Tokens (15 minutes)
- ✅ JWT Refresh Tokens (7 days)
- ✅ Token Refresh Endpoint
- ✅ User Profile Management
- ✅ Role-based Access Control (Student, Instructor, Admin)
- ✅ Protected Routes with Middleware
- ✅ Request Validation
- ✅ Swagger Documentation

## API Endpoints

### Authentication Routes

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login user | No |
| POST | `/api/auth/refresh` | Refresh access token | No |
| GET | `/api/auth/me` | Get current user profile | Yes |
| POST | `/api/auth/logout` | Logout user | Yes |

### Documentation

- **Swagger UI**: `http://localhost:8000/api-docs`
- **OpenAPI JSON**: `http://localhost:8000/api-docs.json`

## Usage Examples

### 1. Register a New User

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "username": "johndoe",
    "full_name": "John Doe"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "user@example.com",
      "username": "johndoe",
      "full_name": "John Doe",
      "role": "student",
      "is_active": true,
      "email_verified": false,
      "created_at": "2025-10-19T22:00:00.000Z",
      "updated_at": "2025-10-19T22:00:00.000Z"
    },
    "tokens": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expires_in": 900,
      "token_type": "Bearer"
    }
  }
}
```

### 2. Login User

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### 3. Get User Profile (Protected Route)

```bash
curl -X GET http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4. Refresh Access Token

```bash
curl -X POST http://localhost:8000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "YOUR_REFRESH_TOKEN"
  }'
```

### 5. Logout User

```bash
curl -X POST http://localhost:8000/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Database Setup

Before using the authentication system, you need to set up the database schema in your Supabase project:

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the SQL schema from `database/schema.sql`

This will create:
- `users` table with user information
- `user_profiles` table for extended profile data
- Row Level Security (RLS) policies
- Indexes for better performance

## User Roles

The system supports three user roles:

- **Student**: Default role for new users
- **Instructor**: Can create and manage courses
- **Admin**: Full system access

## Middleware Usage

### Protect Routes

```typescript
import { authenticateToken } from '../middleware/auth.ts';

// Protect a route
router.get('/protected', authenticateToken, (req, res) => {
  // req.user contains the authenticated user
  res.json({ user: req.user });
});
```

### Role-based Access

```typescript
import { requireAdmin, requireInstructor } from '../middleware/auth.ts';

// Admin only route
router.get('/admin-only', requireAdmin, (req, res) => {
  res.json({ message: 'Admin access granted' });
});

// Instructor or Admin
router.get('/instructor-only', requireInstructor, (req, res) => {
  res.json({ message: 'Instructor access granted' });
});
```

### Resource Ownership

```typescript
import { requireOwnership } from '../middleware/auth.ts';

// Users can only access their own resources
router.get('/users/:userId/profile', requireOwnership('userId'), (req, res) => {
  res.json({ profile: 'User profile data' });
});
```

## Token Management

### Access Token
- **Lifetime**: 15 minutes
- **Purpose**: Authenticate API requests
- **Header**: `Authorization: Bearer <access_token>`

### Refresh Token
- **Lifetime**: 7 days
- **Purpose**: Generate new access tokens
- **Usage**: Send to `/api/auth/refresh` endpoint

### Token Refresh Flow

1. Client receives both access and refresh tokens on login
2. Use access token for API requests
3. When access token expires (15 minutes), use refresh token to get a new one
4. Continue using new access token

## Security Features

- **JWT Tokens**: Secure token-based authentication
- **Password Hashing**: Handled by Supabase Auth
- **Role-based Access**: Granular permission system
- **Request Validation**: Input validation with express-validator
- **Rate Limiting**: Built-in rate limiting middleware
- **CORS Protection**: Configurable CORS settings
- **Helmet Security**: Security headers with Helmet

## Environment Variables

Make sure to set these environment variables in your `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE_TIME=24h
```

## Error Handling

The authentication system includes comprehensive error handling:

- **Validation Errors**: Invalid input data
- **Authentication Errors**: Invalid credentials or tokens
- **Authorization Errors**: Insufficient permissions
- **Database Errors**: Supabase connection issues

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "Error message",
  "details": {} // Optional additional details
}
```

## Testing

You can test the authentication system using:

1. **Swagger UI**: Interactive API documentation at `/api-docs`
2. **cURL commands**: As shown in the examples above
3. **Postman**: Import the OpenAPI spec from `/api-docs.json`

## Next Steps

With the authentication system in place, you can now:

1. Create protected API endpoints
2. Implement user profile management
3. Add course and content management
4. Build the frontend authentication flow
5. Add email verification
6. Implement password reset functionality
