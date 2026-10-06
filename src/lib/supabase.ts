import { createClient } from '@supabase/supabase-js';

const getEnvVar = (key: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  const proc = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
  if (proc?.env?.[key]) {
    return proc.env[key] || '';
  }
  return '';
};

const rawUrl = getEnvVar('VITE_SUPABASE_URL').trim();
const rawKey = getEnvVar('VITE_SUPABASE_ANON_KEY').trim();

// Strip any trailing slashes from the URL as required
export const supabaseUrl = rawUrl.replace(/\/+$/, '');
export const supabaseAnonKey = rawKey;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  !supabaseUrl.includes('your-project-id')
);

if (!isSupabaseConfigured) {
  console.error(
    'CRITICAL ERROR: Supabase is not configured! VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing or invalid in environment.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
