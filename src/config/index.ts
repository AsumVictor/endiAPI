// Configuration management
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface Config {
  port: number;
  nodeEnv: string;
  host: string;
  jwt: {
    secret: string;
    expireTime: string;
  };
  supabase: {
    url: string;
    anonKey: string;
    serviceKey: string;
  };
  cors: {
    origin: string;
  };
  frontend: {
    url: string;
  };
  logging: {
    level: string;
  };
  kafka: {
    brokers: string[];
    username: string;
    password: string;
    produceTopic: string;
    consumeTopic: string;
    compressionTopic: string;
    ssl: boolean;
    saslMechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    connectionTimeout: number;
    requestTimeout: number;
  };
  email: {
    enabled: boolean;
    service?: string;
    host: string;
    port: number;
    secure: boolean;
    from: {
      name: string;
      address: string;
    };
    auth: {
      user: string;
      password: string;
    };
    tls?: {
      rejectUnauthorized: boolean;
    };
  };
  ai: {
    baseUrl: string;
    timeout: number;
  };
  serviceBus: {
    connectionString: string;
    namespace: string;
    jobResultsTopic: string;
    jobResultsSubscription: string;
    transcriptionJobsQueue: string;
    videoCompressionJobsQueue: string;
  };
}

const config: Config = {
  // Server Configuration
  port: Number(process.env['PORT']) || 3000,
  nodeEnv: process.env['NODE_ENV'] || 'development',
  host: process.env['HOST'] || '0.0.0.0',

  // JWT Configuration
  jwt: {
    secret: process.env['JWT_SECRET'] || 'your-jwt-secret-key',
    expireTime: process.env['JWT_EXPIRE_TIME'] || '24h',
  },

  // Supabase Configuration
  supabase: {
    url: process.env['SUPABASE_URL'] || '',
    anonKey: process.env['SUPABASE_ANON_KEY'] || '',
    serviceKey: process.env['SUPABASE_SERVICE_KEY'] || '',
  },

  // CORS Configuration
  cors: {
    origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
  },

  // Frontend Configuration
  frontend: {
    url: process.env['FRONTEND_URL'] || 'http://localhost:3000',
  },

  // Logging Configuration
  logging: {
    level: process.env['LOG_LEVEL'] || 'info',
  },

  // Kafka Configuration
  kafka: {
    brokers: process.env['KAFKA_BROKERS']?.split(',') || [],
    username: process.env['KAFKA_USERNAME'] || '',
    password: process.env['KAFKA_PASSWORD'] || '',
    produceTopic: process.env['KAFKA_PRODUCE_TOPIC'] || 'Transcribe',
    consumeTopic: process.env['KAFKA_CONSUME_TOPIC'] || 'update_transcribe',
    compressionTopic: process.env['KAFKA_COMPRESSION_TOPIC'] || 'finish_compress',
    ssl: process.env['KAFKA_SSL'] !== 'false',
    saslMechanism: (process.env['KAFKA_SASL_MECHANISM'] as 'plain' | 'scram-sha-256' | 'scram-sha-512') || 'scram-sha-256',
    connectionTimeout: Number(process.env['KAFKA_CONNECTION_TIMEOUT']) || 10000,
    requestTimeout: Number(process.env['KAFKA_REQUEST_TIMEOUT']) || 30000,
  },

  // Email Configuration
  email: {
    enabled: process.env['EMAIL_ENABLED'] === 'true',
    ...(process.env['EMAIL_SERVICE'] && { service: process.env['EMAIL_SERVICE'] }), // e.g., 'Gmail', 'SendGrid', 'Outlook'
    host: process.env['EMAIL_HOST'] || 'smtp.gmail.com',
    port: Number(process.env['EMAIL_PORT']) || 587,
    secure: process.env['EMAIL_SECURE'] === 'true', // true for 465, false for other ports
    from: {
      name: process.env['EMAIL_FROM_NAME'] || 'API Server',
      address: process.env['EMAIL_FROM_ADDRESS'] || 'noreply@example.com',
    },
    auth: {
      user: process.env['EMAIL_AUTH_USER'] || '',
      password: process.env['EMAIL_AUTH_PASSWORD'] || '',
    },
    tls: {
      rejectUnauthorized: process.env['EMAIL_TLS_REJECT_UNAUTHORIZED'] !== 'false',
    },
  },

  // AI Server Configuration
  ai: {
    baseUrl: process.env['AI_SERVER_URL'] || '',
    timeout: Number(process.env['AI_SERVER_TIMEOUT']) || 30000, // 30 seconds default
  },

  // Azure Service Bus Configuration
  serviceBus: {
    connectionString: process.env['AZURE_SERVICE_BUS_CONNECTION_STRING'] || '',
    namespace: process.env['AZURE_SERVICE_BUS_NAMESPACE'] || '',
    jobResultsTopic: process.env['AZURE_SERVICE_BUS_JOB_RESULTS_TOPIC'] || 'job-results',
    jobResultsSubscription: process.env['AZURE_SERVICE_BUS_JOB_RESULTS_SUBSCRIPTION'] || 'server-b-results',
    transcriptionJobsQueue: process.env['AZURE_SERVICE_BUS_TRANSCRIPTION_JOBS_QUEUE'] || 'transcription-jobs',
    videoCompressionJobsQueue: process.env['AZURE_SERVICE_BUS_VIDEO_COMPRESSION_JOBS_QUEUE'] || 'video-compression-jobs',
  },
};

export default config;