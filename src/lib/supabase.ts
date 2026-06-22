/**
 * Supabase client — the single entry point for cloud auth + sync.
 *
 * Reads config from Vite env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
 * When either is missing the client is `null` and `isCloudConfigured` is false,
 * so the rest of the app degrades gracefully to its original local-only mode.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True only when both env vars are present — gate all cloud calls on this. */
export const isCloudConfigured = Boolean(url && anonKey);

/** Postgres table that mirrors local IndexedDB canvases (one row per canvas). */
export const CANVASES_TABLE = 'canvases';

export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true, // keep the user signed in across reloads / restarts
        autoRefreshToken: true,
        detectSessionInUrl: false, // no OAuth redirect flow in v1 (email/password)
      },
    })
  : null;
