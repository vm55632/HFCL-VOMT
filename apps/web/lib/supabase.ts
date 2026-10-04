import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Public Supabase browser client. URL + anon key are public by design (RLS/JWT protect data).
// Configured via Next.js public env; see .env.local.example.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

let client: SupabaseClient | null = null;

/** Lazily create the singleton browser client. Returns null if Supabase is not configured. */
export function getSupabase(): SupabaseClient | null {
  if (!url || !anon) return null;
  if (!client) {
    client = createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

/** True when the app is configured to use Supabase Auth. */
export const supabaseAuthEnabled = Boolean(url && anon);

/** Current Supabase access token (JWT) for Authorization headers, or null. */
export async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) return data.session.access_token;
  // Fallback for the restore race on a hard page load: read the persisted session directly.
  return readPersistedToken();
}

/** Read the access token supabase-js persists in localStorage (sb-<ref>-auth-token). */
function readPersistedToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as {
          access_token?: string;
          currentSession?: { access_token?: string };
        };
        const token = parsed.access_token ?? parsed.currentSession?.access_token;
        if (token) return token;
      }
    }
  } catch {
    /* storage blocked — fall through */
  }
  return null;
}
