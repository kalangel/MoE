import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Ключи читаются ТОЛЬКО из окружения (.env), в код не вписываются.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const onlineConfigured = Boolean(url && anon);

export const supabase: SupabaseClient | null = onlineConfigured
  ? createClient(url!, anon!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

// Доступ для отладки в dev-режиме (в проде не экспонируется).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __supabase?: SupabaseClient | null }).__supabase = supabase;
}
