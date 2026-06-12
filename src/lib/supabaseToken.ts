/**
 * Bridge between Clerk authentication and the Supabase clients.
 *
 * Supabase is configured with Clerk as a third-party auth provider, so every
 * PostgREST/Realtime request must carry the user's Clerk session JWT. The
 * Supabase clients are created at module load — before Clerk has initialised —
 * so they read the token lazily through this registry. AuthContext registers
 * the live session's getToken function once Clerk loads.
 *
 * When no user is signed in the getter returns null and supabase-js falls back
 * to the anon key — which, under the hardened RLS policies, can read nothing.
 */

type TokenGetter = () => Promise<string | null>;

let clerkTokenGetter: TokenGetter | null = null;

export function registerSupabaseTokenGetter(getter: TokenGetter | null): void {
  clerkTokenGetter = getter;
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  if (!clerkTokenGetter) {
    return null;
  }
  try {
    return await clerkTokenGetter();
  } catch {
    // A failed token fetch must degrade to anon (unauthenticated), never throw
    // into arbitrary data-layer call sites.
    return null;
  }
}
