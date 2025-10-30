import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@app-types/supabase';

type ClientMode = 'anon' | 'service';

type GlobalScope = typeof globalThis & {
  __supabaseTestClients__?: Map<ClientMode, SupabaseClient<Database>>;
  __supabaseTestClientLogs__?: Set<string>;
};

const globalScope = globalThis as GlobalScope;
const clientCache =
  globalScope.__supabaseTestClients__ ??
  (() => {
    const cache = new Map<ClientMode, SupabaseClient<Database>>();
    globalScope.__supabaseTestClients__ = cache;
    return cache;
  })();

const resolveWorkerId = () =>
  process.env.VITEST_WORKER_ID ??
  process.env.JEST_WORKER_ID ??
  process.env.TAP_WORKER_ID ??
  'main';

const ensureEnv = (key: string, message: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(message);
  }
  return value;
};

interface GetClientOptions {
  mode?: ClientMode;
  fallbackToAnon?: boolean;
}

export const getSupabaseTestClient = ({
  mode = 'anon',
  fallbackToAnon = false,
}: GetClientOptions = {}): SupabaseClient<Database> => {
  const supabaseUrl = ensureEnv(
    'VITE_SUPABASE_URL',
    'Supabase URL missing – set VITE_SUPABASE_URL in your test environment.',
  );

  const desiredMode = mode;
  let effectiveMode = desiredMode;

  const serviceRoleKey =
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (desiredMode === 'service' && !serviceRoleKey) {
    if (!fallbackToAnon) {
      throw new Error(
        'Supabase service role key missing – set VITE_SUPABASE_SERVICE_ROLE_KEY when requesting service mode.',
      );
    }
    effectiveMode = 'anon';
  }

  if (clientCache.has(effectiveMode)) {
    return clientCache.get(effectiveMode)!;
  }

  const supabaseKey =
    effectiveMode === 'service'
      ? ensureEnv(
          'VITE_SUPABASE_SERVICE_ROLE_KEY',
          'Supabase service role key missing – set VITE_SUPABASE_SERVICE_ROLE_KEY in your test environment.',
        )
      : ensureEnv(
          'VITE_SUPABASE_ANON_KEY',
          'Supabase anon key missing – set VITE_SUPABASE_ANON_KEY in your test environment.',
        );

  const workerId = resolveWorkerId();
  const storageKey = `supabase-test-${effectiveMode}-${workerId}`;

  const client = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey,
    },
    global:
      effectiveMode === 'service'
        ? {
            headers: {
              'X-Client-Info': 'supabase-tests-service-role',
            },
          }
        : undefined,
  });

  // Diagnostic logging to track client creation
  const logKey = `${effectiveMode}-${workerId}`;
  const logSet = globalScope.__supabaseTestClientLogs__ ?? new Set<string>();
  if (!globalScope.__supabaseTestClientLogs__) {
    globalScope.__supabaseTestClientLogs__ = logSet;
  }

  if (!logSet.has(logKey)) {
    logSet.add(logKey);
    const stack = new Error().stack?.split('\n').slice(2, 6).join('\n') ?? 'no stack';
    process.stdout.write(
      `[SupabaseTestClient] created new client | mode=${effectiveMode} | worker=${workerId}\n${stack}\n\n`
    );
  }

  clientCache.set(effectiveMode, client);
  return client;
};
