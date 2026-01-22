// Supabase configuration
import { createClient } from '@supabase/supabase-js';
import config from './index.js';

// Supabase client configuration
const supabaseConfig = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
};

// Create Supabase client
export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey,
  supabaseConfig
);

// Create Supabase client for user operations (with anon key)
export const supabaseAuth = createClient(
  config.supabase.url,
  config.supabase.anonKey,
  supabaseConfig
);

export default supabase;