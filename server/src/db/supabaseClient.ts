import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  if (!config.supabase.isConfigured) {
    console.log('[Database] Supabase credentials not fully configured. Using in-memory database adapter for local development.');
    return null;
  }

  try {
    const key = config.supabase.serviceRoleKey || config.supabase.anonKey;
    supabaseInstance = createClient(config.supabase.url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log('[Database] Connected to Supabase PostgreSQL at:', config.supabase.url);
    return supabaseInstance;
  } catch (error) {
    console.error('[Database] Failed to initialize Supabase client:', error);
    return null;
  }
}
