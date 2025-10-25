# API Server

A Node.js + Express + TypeScript API server with Supabase integration and comprehensive configuration.

## Project Structure

```
API-server/
├── src/
│   ├── app.ts                 # Main Express application
│   ├── server.ts              # Server startup file
│   ├── config/
│   │   ├── index.ts          # Main configuration
│   │   └── database.ts       # Supabase configuration
│   ├── middleware/
│   │   └── index.ts          # Middleware configuration
│   ├── routes/
│   │   └── index.ts          # Main routes
│   └── utils/
│       ├── index.ts          # Utility functions
│       ├── logger.ts         # Logging configuration
│       └── errors.ts         # Error handling
├── dist/                     # Compiled JavaScript output
├── logs/                     # Log files directory
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── nodemon.json              # Nodemon configuration
├── env.example              # Environment variables example
└── README.md                # This file
```

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp env.example .env
   # Edit .env with your Supabase configuration
   ```

3. **Start the server:**
   ```bash
   # Development mode (with TypeScript compilation)
   npm run dev
   
   # Build TypeScript
   npm run build
   
   # Production mode
   npm start
   ```

## Environment Variables

Copy `env.example` to `.env` and configure:

- `PORT`: Server port (default: 8000)
- `NODE_ENV`: Environment (development/production)
- `HOST`: Server host (default: 0.0.0.0)
- `JWT_SECRET`: JWT secret key for token verification
- `JWT_EXPIRE_TIME`: JWT expiration time (default: 24h)
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_KEY`: Supabase service role key
- `CORS_ORIGIN`: CORS origin URLs (comma-separated)
- `LOG_LEVEL`: Logging level (info/debug/error)

## Available Endpoints

- `GET /api/health` - Health check endpoint
- `GET /api/` - Root endpoint with API information

## Features

- ✅ Express.js + TypeScript server setup
- ✅ Supabase integration with client configuration
- ✅ Environment configuration with type safety
- ✅ CORS middleware with multiple origins support
- ✅ Security middleware (Helmet)
- ✅ Rate limiting
- ✅ Request logging with Winston
- ✅ Comprehensive error handling with custom error classes
- ✅ JWT authentication middleware (placeholder)
- ✅ Health check endpoint with Supabase status
- ✅ Graceful shutdown handling
- ✅ TypeScript compilation and development setup

## Development

- **Start development server:** `npm run dev` (uses ts-node with auto-reload)
- **Build TypeScript:** `npm run build`
- **Watch TypeScript compilation:** `npm run dev:build`
- **View logs:** Check `logs/` directory
- **Environment:** Development mode with TypeScript compilation

## Production

- **Build TypeScript:** `npm run build`
- **Start production server:** `npm start` (runs compiled JavaScript)
- **Environment:** Production mode with optimized logging
- **Graceful shutdown:** Handles SIGTERM signals

## Supabase Integration

The server is configured with Supabase clients:

- **Service Role Client**: For backend operations (bypasses RLS)
- **Anonymous Client**: For user authentication operations
- **Environment Configuration**: All Supabase settings loaded from environment variables

## Next Steps

This is a TypeScript + Supabase foundation setup. You can now add:

- Authentication routes with Supabase Auth
- Database models and controllers using Supabase client
- JWT token verification middleware
- API routes for your application logic
- Database queries using Supabase PostgREST client
- File uploads using Supabase Storage
- Real-time subscriptions using Supabase Realtime
- Testing setup with TypeScript
- Docker configuration
