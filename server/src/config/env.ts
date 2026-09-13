import dotenv from 'dotenv';
import path from 'path';

// Load .env file from server root or parent
dotenv.config();

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  supabase: {
    url: string;
    serviceRoleKey: string;
    anonKey: string;
    isConfigured: boolean;
  };
}

const port = parseInt(process.env.PORT || '3001', 10);
const nodeEnv = process.env.NODE_ENV || 'development';
const corsOrigin = process.env.CORS_ORIGIN || '*';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

const isConfigured = Boolean(
  supabaseUrl && 
  supabaseUrl.startsWith('http') && 
  (supabaseServiceRoleKey || supabaseAnonKey)
);

export const config: ServerConfig = {
  port,
  nodeEnv,
  corsOrigin,
  supabase: {
    url: supabaseUrl,
    serviceRoleKey: supabaseServiceRoleKey,
    anonKey: supabaseAnonKey,
    isConfigured,
  },
};
