# CodeEndelea LMS API Server

A comprehensive Learning Management System (LMS) API server built with Node.js, Express, and TypeScript, featuring Supabase integration, Kafka event streaming, AI service integration, and email notifications.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Authentication & Authorization](#authentication--authorization)
- [Services](#services)
- [Middleware](#middleware)
- [Configuration](#configuration)
- [Development Workflow](#development-workflow)
- [Scripts & Utilities](#scripts--utilities)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Overview

This API server powers the CodeEndelea Learning Management System, providing:

- **User Management**: Registration, authentication, and profile management for students, lecturers, and admins
- **Course Management**: Create, update, and manage courses with enrollment functionality
- **Video Processing**: Upload videos, track progress, and manage video content with automatic transcription
- **AI Integration**: Proxy service for external AI endpoints (code explanations, interactions, assessments)
- **Event-Driven Architecture**: Kafka integration for asynchronous video transcription and compression processing
- **Email Notifications**: Automated email sending with templating support
- **API Documentation**: Swagger/OpenAPI documentation for all endpoints

### Key Features

- ✅ JWT-based authentication with Supabase Auth
- ✅ Row Level Security (RLS) policies in Supabase
- ✅ Asynchronous video transcription via Kafka
- ✅ Real-time video compression updates
- ✅ AI service integration with timeout handling
- ✅ Email service with template support
- ✅ Comprehensive error handling and logging
- ✅ Rate limiting and security middleware
- ✅ TypeScript for type safety
- ✅ RESTful API design

## Tech Stack

### Core Technologies

- **Runtime**: Node.js (ES2020+)
- **Framework**: Express.js 4.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Message Queue**: Apache Kafka (via KafkaJS)

### Key Dependencies

- **@supabase/supabase-js**: Supabase client for database and auth
- **jsonwebtoken**: JWT token generation and verification
- **kafkajs**: Kafka producer and consumer
- **nodemailer**: Email sending service
- **express-validator**: Request validation
- **winston**: Logging framework
- **helmet**: Security headers
- **cors**: Cross-origin resource sharing
- **swagger-jsdoc**: API documentation generation

## Architecture Overview

```
┌─────────────┐
│   Client    │
│  (Frontend) │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────────────────────────┐
│      Express.js API Server          │
│  ┌───────────────────────────────┐  │
│  │    Middleware Layer           │  │
│  │  - Auth, CORS, Rate Limit     │  │
│  └──────────────┬────────────────┘  │
│                 ▼                    │
│  ┌───────────────────────────────┐  │
│  │    Routes Layer               │  │
│  │  - /api/auth, /api/videos     │  │
│  └──────────────┬────────────────┘  │
│                 ▼                    │
│  ┌───────────────────────────────┐  │
│  │    Services Layer             │  │
│  │  - Auth, Video, AI, Email     │  │
│  └──────────────┬────────────────┘  │
└────────┬────────┼───────────┬────────┘
         │        │           │
    ┌────▼────┐ ┌─▼──┐  ┌────▼────┐
    │ Supabase│ │Kafka│  │AI Server│
    │  (DB +  │ │     │  │ (Proxy) │
    │   Auth) │ │     │  │         │
    └─────────┘ └─────┘  └─────────┘
```

### Data Flow

1. **Client Request** → Express Middleware (auth, validation)
2. **Route Handler** → Service Layer (business logic)
3. **Service Layer** → Supabase (database operations)
4. **Event Publishing** → Kafka (for async processing)
5. **Event Consumption** → Kafka Consumers (update database)
6. **Response** → Client (JSON)

## Project Structure

```
API-server/
├── src/
│   ├── app.ts                      # Main Express application setup
│   ├── server.ts                   # Server startup and lifecycle management
│   ├── config/
│   │   ├── index.ts               # Centralized configuration
│   │   ├── database.ts            # Supabase client setup
│   │   ├── kafka.ts               # Kafka client configuration
│   │   └── swagger.ts             # Swagger/OpenAPI setup
│   ├── middleware/
│   │   ├── index.ts               # General middleware (CORS, security, rate limit)
│   │   └── auth.ts                # Authentication & authorization middleware
│   ├── models/
│   │   ├── user.ts                # User, Student, Lecturer interfaces
│   │   ├── course.ts              # Course, Enrollment interfaces
│   │   └── video.ts               # Video, VideoProgress interfaces
│   ├── routes/
│   │   ├── index.ts               # Main router (mounts all routes)
│   │   ├── auth.ts                # Authentication routes
│   │   ├── course.ts              # Course management routes
│   │   ├── video.ts               # Video management routes
│   │   ├── lecturer.ts            # Lecturer-specific routes
│   │   ├── student.ts             # Student-specific routes
│   │   └── ai.ts                  # AI service proxy routes
│   ├── services/
│   │   ├── auth.ts                # Authentication service
│   │   ├── video.ts               # Video CRUD and progress tracking
│   │   ├── course.ts              # Course management service
│   │   ├── student.ts             # Student profile service
│   │   ├── ai.ts                  # AI service proxy
│   │   ├── kafka-producer.ts      # Kafka producer (send events)
│   │   ├── kafka-consumer.ts      # Kafka consumer (transcription results)
│   │   └── kafka-compression-consumer.ts  # Compression results consumer
│   ├── utils/
│   │   ├── errors.ts              # Custom error classes and handlers
│   │   ├── jwt.ts                 # JWT token generation/verification
│   │   ├── logger.ts              # Winston logger configuration
│   │   ├── cookies.ts             # Cookie management utilities
│   │   ├── email.ts               # Email service (Nodemailer)
│   │   └── email/
│   │       ├── template-loader.ts # Email template loader
│   │       └── templates/         # HTML email templates
│   ├── scripts/
│   │   ├── create-beta-users.ts   # Batch user creation script
│   │   ├── test-kafka.ts          # Kafka testing utilities
│   │   └── kafka-consumer-worker.ts  # Standalone consumer worker
│   └── views/
│       └── swagger.html           # Swagger UI view
├── database/
│   └── schema.sql                 # Database schema and RLS policies
├── dist/                          # Compiled JavaScript (generated)
├── logs/                          # Log files (generated)
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── env.example                    # Environment variables template
└── README.md                      # This file
```

## Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- **Supabase Account** (for database and auth)
- **Kafka Broker** (optional, for video processing features)
- **Email Service** (optional, for email notifications)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Code-Endelea/API-server.git
   cd API-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Set up Supabase database**
   - Create a new Supabase project
   - Run the SQL schema: `database/schema.sql` in the Supabase SQL Editor
   - Get your Supabase URL and keys from Settings → API

5. **Start the development server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:8000` (or your configured PORT).

### Verify Installation

- **Health Check**: `GET http://localhost:8000/api/health`
- **API Documentation**: `http://localhost:8000/api-docs`
- **Root Endpoint**: `GET http://localhost:8000/api/`

## Environment Variables

Create a `.env` file in the root directory with the following variables:

### Required Variables

```env
# Supabase Configuration
SUPABASE_URL=  # add supabase project URL
SUPABASE_ANON_KEY=  # add supabase anonymous key
SUPABASE_SERVICE_KEY=  # add supabase service role key

# JWT Configuration
JWT_SECRET=  # add JWT secret key
JWT_EXPIRE_TIME=  # add JWT expiration time (e.g., 24h)

# Server Configuration
PORT=  # add server port number
HOST=  # add server host address
NODE_ENV=  # add environment (development, production, etc.)

# Frontend URL (for email redirects)
FRONTEND_URL=  # add frontend application URL
```

### Optional Variables

```env
# CORS Configuration
CORS_ORIGIN=  # add allowed CORS origins (comma-separated)

# Kafka Configuration
KAFKA_BROKERS=  # add kafka broker addresses (comma-separated)
KAFKA_USERNAME=  # add kafka username
KAFKA_PASSWORD=  # add kafka password
KAFKA_PRODUCE_TOPIC=  # add producer topic name
KAFKA_CONSUME_TOPIC=  # add consumer topic name
KAFKA_COMPRESSION_TOPIC=  # add compression topic name
KAFKA_SSL=  # set to true for SSL/TLS
KAFKA_SASL_MECHANISM=  # add SASL mechanism (e.g., scram-sha-256)

# Email Configuration (Nodemailer)
EMAIL_ENABLED=  # set to true to enable email service
EMAIL_SERVICE=  # add email service name (Gmail, SendGrid, Outlook, etc.)
EMAIL_HOST=  # add SMTP hostname
EMAIL_PORT=  # add SMTP port
EMAIL_SECURE=  # set to true for SSL, false for TLS
EMAIL_FROM_NAME=  # add sender display name
EMAIL_FROM_ADDRESS=  # add sender email address
EMAIL_AUTH_USER=  # add email authentication username
EMAIL_AUTH_PASSWORD=  # add email authentication password

# AI Server Configuration
AI_SERVER_URL=  # add AI server URL
AI_SERVER_TIMEOUT=  # add timeout in milliseconds

# Logging
LOG_LEVEL=  # add log level (debug, info, error, etc.)
```

See `env.example` for the complete template.

## Database Schema

### Core Tables

#### `users`
- Stores basic user information (synced with Supabase Auth)
- Fields: `id` (UUID), `email`, `role`, `created_at`
- Role types: `student`, `lecturer`, `admin`

#### `students`
- Student profile information
- Fields: `id`, `user_id`, `first_name`, `last_name`, `class_year`, `major`, `bio`, `avatar_url`, `streak_count`, `last_login`

#### `lecturers`
- Lecturer profile information
- Fields: `id`, `user_id`, `first_name`, `last_name`, `bio`, `avatar_url`, `classes_teaching` (array)

#### `courses`
- Course information
- Fields: `id`, `title`, `description`, `thumbnail_url`, `lecturer_id`, `created_at`

#### `course_enrollments`
- Student course enrollments
- Fields: `id`, `course_id`, `student_id`, `enrolled_at`
- Unique constraint on `(course_id, student_id)`

#### `videos`
- Video content metadata
- Fields: `id`, `course_id`, `title`, `description`, `thumbnail_url`, `camera_video_url`, `snapshot_url`, `event_url`, `transcript_url`, `level`, `ispublic`, `created_at`
- Level types: `beginner`, `intermediate`, `advanced`

#### `video_progress`
- Student video progress tracking
- Fields: `id`, `video_id`, `student_id`, `completed`, `completed_at`
- Unique constraint on `(video_id, student_id)`

### Row Level Security (RLS)

All tables have RLS enabled with policies that:
- Allow users to view/edit their own profiles
- Allow lecturers to view student profiles
- Allow students to view public videos and enrolled course videos
- Allow lecturers to manage their own courses and videos

See `database/schema.sql` for complete RLS policies.

## API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Register a new user (student/lecturer) | No |
| POST | `/login` | Login and get access/refresh tokens | No |
| POST | `/refresh` | Refresh access token | No |
| GET | `/verify-email` | Backend redirect for email verification | No |
| GET | `/me` | Get current user profile | Yes |
| PUT | `/me` | Update current user profile | Yes |

### Courses (`/api/courses`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | List all courses (public) | No |
| GET | `/my-courses` | Get courses for current user | Yes |
| GET | `/enrolled` | Get enrolled courses (students) | Yes (Student) |
| GET | `/:id` | Get course details | No |
| POST | `/` | Create a new course | Yes (Lecturer) |
| PUT | `/:id` | Update course | Yes (Lecturer/Owner) |
| DELETE | `/:id` | Delete course | Yes (Lecturer/Owner) |
| POST | `/:id/enroll` | Enroll in course | Yes (Student) |
| DELETE | `/:id/enroll` | Unenroll from course | Yes (Student) |

### Videos (`/api/videos`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | List videos (with filters) | Optional |
| GET | `/course/:courseId` | Get videos for a course | No |
| GET | `/:id` | Get video details | Optional |
| POST | `/course/:courseId` | Create a new video | Yes (Lecturer) |
| PUT | `/:id` | Update video | Yes (Lecturer/Owner) |
| DELETE | `/:id` | Delete video | Yes (Lecturer/Owner) |
| POST | `/:id/progress` | Update video progress | Yes (Student) |
| GET | `/progress` | Get user's video progress | Yes (Student) |
| GET | `/course/:courseId/completions` | Get completion stats | Yes (Lecturer) |

### Students (`/api/students`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/me` | Get current student profile | Yes (Student) |
| PUT | `/me` | Update student profile | Yes (Student) |
| GET | `/me/progress` | Get student's video progress | Yes (Student) |

### Lecturers (`/api/lecturers`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/me` | Get current lecturer profile | Yes (Lecturer) |
| PUT | `/me` | Update lecturer profile | Yes (Lecturer) |
| GET | `/me/courses` | Get lecturer's courses | Yes (Lecturer) |
| GET | `/me/statistics` | Get lecturer statistics | Yes (Lecturer) |

### AI Service (`/api/ai`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/explain` | Explain code with context | Optional |
| POST | `/interaction` | General AI interaction | Optional |
| POST | `/assessment` | Generate assessment | Optional |
| POST | `/assessment-topic` | Generate assessment from topic | Optional |
| POST | `/assessment-pdf` | Generate assessment from PDF | Optional |

### Health & Documentation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check endpoint |
| GET | `/api/` | API information |
| GET | `/api-docs` | Swagger UI documentation |
| GET | `/api-docs.json` | OpenAPI JSON spec |

## Authentication & Authorization

### Authentication Flow

1. **Registration**
   - User submits registration form
   - Server creates Supabase Auth user
   - If email confirmation is enabled, user receives confirmation email
   - User profile is created in `users`, `students`, or `lecturers` table

2. **Login**
   - User submits email/password
   - Server verifies with Supabase Auth
   - JWT access token and refresh token are generated
   - Tokens returned as HTTP-only cookies or JSON response

3. **Token Refresh**
   - Client sends refresh token
   - Server validates and issues new access token

4. **Email Verification** (if enabled)
   - User clicks link in confirmation email
   - Supabase redirects to frontend callback route
   - Frontend extracts token from URL hash
   - Frontend exchanges token for session

### Authorization

The API uses role-based access control (RBAC):

- **Public**: Health check, public courses/videos
- **Authenticated**: User's own profile, enrolled courses
- **Student**: Student-specific routes, video progress
- **Lecturer**: Course/video creation, student progress viewing
- **Admin**: Full system access

### Middleware

- `authenticateToken`: Verifies JWT and attaches user to request
- `requireRole(['student'])`: Requires specific role(s)
- `requireAdmin`: Requires admin role
- `optionalAuth`: Attaches user if token present (doesn't fail if missing)

## Services

### AuthService (`src/services/auth.ts`)

Handles authentication and user management:

- `register()`: Create new user with Supabase Auth
- `login()`: Authenticate user and generate tokens
- `refreshToken()`: Refresh access token
- `getUserById()`: Fetch user by ID
- `getUserByEmail()`: Fetch user by email

### VideoService (`src/services/video.ts`)

Manages video content and progress:

- `createVideo()`: Create video and send to Kafka for transcription
- `getVideoById()`: Fetch video details
- `updateVideo()`: Update video metadata
- `deleteVideo()`: Delete video
- `updateProgress()`: Track student video progress
- `getProgress()`: Get student's progress for videos
- `updateCameraVideoUrl()`: Update video URL after compression (used by Kafka consumer)
- `updateTranscript()`: Update transcript URL after transcription (used by Kafka consumer)

### AIService (`src/services/ai.ts`)

Proxies requests to external AI server:

- `explain()`: Code explanation with file system context
- `interaction()`: General AI interaction
- `assessment()`: Generate assessment
- `assessmentTopic()`: Generate assessment from topic
- `assessmentPdf()`: Generate assessment from PDF text

Features:
- Automatic user ID injection
- Configurable timeout
- Detailed error parsing from AI server

### KafkaProducerService (`src/services/kafka-producer.ts`)

Publishes events to Kafka:

- `sendTranscriptionRequest()`: Send video transcription request
- Automatically connects on first use
- Handles connection errors gracefully

### KafkaConsumerService (`src/services/kafka-consumer.ts`)

Consumes transcription results:

- Subscribes to `update_transcribe` topic
- Updates `transcript_url` in videos table
- Handles errors and retries

### KafkaCompressionConsumerService (`src/services/kafka-compression-consumer.ts`)

Consumes video compression results:

- Subscribes to `finish_compress` topic
- Updates `camera_video_url` in videos table
- Processes messages with video ID and cloud URL

### EmailService (`src/utils/email.ts`)

Sends emails using Nodemailer:

- `sendEmail()`: Generic email sending
- `sendWelcomeEmail()`: Welcome email template
- `sendPasswordResetEmail()`: Password reset email
- `sendVerificationEmail()`: Email verification
- `sendBetaConfirmationEmail()`: Beta user access confirmation

Supports:
- Gmail, SendGrid, Outlook, and custom SMTP
- HTML templates with variable substitution
- Attachment support

## Middleware

### Security (`src/middleware/index.ts`)

- **Helmet**: Security headers (CSP, XSS protection, etc.)
- **CORS**: Cross-origin resource sharing (configurable origins)
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Request Logging**: Morgan logger for HTTP requests

### Authentication (`src/middleware/auth.ts`)

- **authenticateToken**: Verifies JWT from Authorization header or cookie
- **requireRole**: Role-based access control
- **optionalAuth**: Optional authentication (doesn't fail if no token)

## Configuration

### Config Structure (`src/config/index.ts`)

Centralized configuration loading from environment variables:

```typescript
{
  port: number;
  nodeEnv: string;
  host: string;
  jwt: { secret: string; expireTime: string };
  supabase: { url: string; anonKey: string; serviceKey: string };
  cors: { origin: string };
  frontend: { url: string };
  kafka: { brokers, username, password, topics, ssl, saslMechanism };
  email: { enabled, host, port, auth, templates };
  ai: { baseUrl, timeout };
}
```

### Supabase Client (`src/config/database.ts`)

Two Supabase clients:
- **Service Role Client**: Bypasses RLS (for backend operations)
- **Anonymous Client**: Respects RLS (for user operations)

## Development Workflow

### Running the Server

```bash
# Development mode (auto-reload with nodemon)
   npm run dev
   
   # Build TypeScript
   npm run build
   
# Production mode (runs compiled JS)
   npm start
   ```

### Code Organization

1. **Models**: TypeScript interfaces matching database schema
2. **Services**: Business logic and database operations
3. **Routes**: Express route handlers with validation
4. **Middleware**: Request processing (auth, validation, logging)

### Adding a New Endpoint

1. Define model interface in `src/models/`
2. Create service method in `src/services/`
3. Add route handler in `src/routes/`
4. Mount route in `src/routes/index.ts`
5. Add Swagger documentation in route file
6. Test with `npm run dev`

### TypeScript Configuration

- **Strict Mode**: Enabled for type safety
- **Module System**: ES2020 modules
- **Target**: ES2020
- **No Emit**: TypeScript used for type checking only (runtime uses tsx)

## Scripts & Utilities

### Available NPM Scripts

```bash
npm run dev              # Start development server (nodemon)
npm run build            # Compile TypeScript to JavaScript
npm run start            # Start production server
npm run create-beta-users # Create beta users from script
npm run kafka:test       # Test Kafka producer/consumer
```

### Utility Scripts (`src/scripts/`)

- **create-beta-users.ts**: Batch create users and send welcome emails
  - Supports array or object input
  - Auto-generates passwords
  - Sends beta confirmation emails

- **test-kafka.ts**: Test Kafka connectivity and message sending
- **kafka-consumer-worker.ts**: Standalone Kafka consumer worker

## Deployment

### Environment Setup

1. Set all required environment variables
2. Ensure Supabase project is configured
3. Set up Kafka brokers (if using video features)
4. Configure email service (if using email features)

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production CORS origins
- [ ] Set secure JWT secret
- [ ] Enable email service
- [ ] Configure Kafka brokers
- [ ] Set up log aggregation
- [ ] Configure reverse proxy (nginx)
- [ ] Enable HTTPS
- [ ] Set up monitoring and alerts

### Docker (Future)

Docker configuration not yet implemented, but recommended structure:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 8000
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

#### 1. Supabase Connection Errors

**Problem**: Cannot connect to Supabase
**Solution**: 
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `.env`
- Check Supabase project status
- Verify network connectivity

#### 2. Kafka Connection Timeout

**Problem**: Kafka producer/consumer fails to connect
**Solution**:
- Verify `KAFKA_BROKERS` format (comma-separated)
- Check Kafka broker accessibility
- Verify SSL/SASL credentials
- Check firewall rules

#### 3. Email Sending Fails

**Problem**: Email service not sending emails
**Solution**:
- Verify `EMAIL_ENABLED=true`
- Check SMTP credentials
- For Gmail: Use App Password (not account password)
- Verify `EMAIL_FROM_ADDRESS` matches authenticated email
- Check email service logs

#### 4. JWT Token Errors

**Problem**: "Invalid or expired token" errors
**Solution**:
- Verify `JWT_SECRET` matches across services
- Check token expiration time
- Ensure tokens are sent in `Authorization: Bearer <token>` header
- Verify token format

#### 5. TypeScript Compilation Errors

**Problem**: Type errors during build
**Solution**:
- Run `npm run build` to see all errors
- Check `tsconfig.json` settings
- Verify all imports use `.ts` extension
- Ensure all environment variables are typed

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=  # add log level (e.g., debug, info, error)
```

View logs in `logs/` directory:
- `combined.log`: All logs
- `error.log`: Error logs only

## Contributing

### Code Style

- Use TypeScript for all new code
- Follow existing code patterns
- Use async/await for asynchronous operations
- Handle errors with try/catch
- Use custom `AppError` class for API errors

### Commit Messages

Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Test additions/changes

### Pull Request Process

1. Create feature branch from `main`
2. Make changes with tests
3. Update documentation if needed
4. Submit PR with description
5. Address review feedback

### Testing (Future)

Test suite not yet implemented. Recommended:
- Unit tests for services
- Integration tests for routes
- E2E tests for critical flows

## Additional Resources

- **API Documentation**: `http://localhost:8000/api-docs` (Swagger UI)
- **Supabase Docs**: https://supabase.com/docs
- **Kafka Docs**: https://kafka.apache.org/documentation/
- **Express Docs**: https://expressjs.com/

## License

ISC

## Support

For questions or issues:
- Open an issue on GitHub
- Contact: contact@codeendelea.com

---

**Last Updated**: 2024
