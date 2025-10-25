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
}

const config: Config = {
  // Server Configuration
  port: parseInt(process.env['PORT'] || '8000', 10),
  nodeEnv: process.env['NODE_ENV'] || 'development',
  host: process.env['HOST'] || 'localhost',

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
};

export default config;