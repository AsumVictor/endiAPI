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
  logging: {
    level: string;
  };
  kafka: {
    brokers: string[];
    username: string;
    password: string;
    produceTopic: string;
    consumeTopic: string;
    ssl: boolean;
    saslMechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    connectionTimeout: number;
    requestTimeout: number;
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
    ssl: process.env['KAFKA_SSL'] !== 'false',
    saslMechanism: (process.env['KAFKA_SASL_MECHANISM'] as 'plain' | 'scram-sha-256' | 'scram-sha-512') || 'scram-sha-256',
    connectionTimeout: Number(process.env['KAFKA_CONNECTION_TIMEOUT']) || 10000,
    requestTimeout: Number(process.env['KAFKA_REQUEST_TIMEOUT']) || 30000,
  },
};

export default config;