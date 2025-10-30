import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const defaultEnvFiles = ['.env', '.env.test', '.env.test.local'];
const defaultSupabaseOptions = {
  modeKey: 'VITEST_SUPABASE_MODE',
  defaultMode: 'mock',
  requiredWhenReal: [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_SERVICE_ROLE_KEY',
    'VITEST_SUPABASE_EMAIL',
    'VITEST_SUPABASE_PASSWORD',
  ],
};

const pickEnv = (key, fallback = '') => {
  const value = process.env[key];
  if (!value && fallback) {
    process.env[key] = fallback;
    return fallback;
  }
  return value ?? fallback;
};

/**
 * Loads environment variables for Vitest/Vite test runs and ensures
 * `import.meta.env` mirrors the resolved values.
 *
 * @param {object} options
 * @param {string[]} [options.envFiles]
 * @param {Record<string, string>} [options.defaultValues]
 * @param {{ modeKey?: string; defaultMode?: string; requiredWhenReal?: string[] }} [options.supabase]
 * @param {{ import?: { meta?: { env?: Record<string, string | boolean> } } }} [options.target]
 * @returns {Record<string, string | boolean>}
 */
export const loadViteTestEnv = (options = {}) => {
  const {
    envFiles = defaultEnvFiles,
    defaultValues = {},
    supabase = {},
    target = globalThis,
  } = options;

  for (const fileName of envFiles) {
    const filePath = resolve(process.cwd(), fileName);
    if (existsSync(filePath)) {
      loadEnv({ path: filePath, override: false });
    }
  }

  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
  }

  const supabaseOptions = {
    ...defaultSupabaseOptions,
    ...supabase,
  };

  const env = {
    MODE: 'test',
    DEV: false,
    PROD: false,
    SSR: false,
  };

  for (const [key, fallback] of Object.entries(defaultValues)) {
    env[key] = pickEnv(key, fallback);
  }

  const supabaseMode = pickEnv(
    supabaseOptions.modeKey,
    supabaseOptions.defaultMode,
  );

  env[supabaseOptions.modeKey] = supabaseMode;

  if (
    supabaseMode === 'real' &&
    Array.isArray(supabaseOptions.requiredWhenReal)
  ) {
    const missingKeys = supabaseOptions.requiredWhenReal
      .map((key) => [key, process.env[key] ?? env[key]])
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingKeys.length > 0) {
      throw new Error(
        `Missing Supabase credentials for real-mode tests: ${missingKeys.join(
          ', ',
        )}. Populate them in .env.test / .env.test.local before running with ${supabaseOptions.modeKey}=real.`,
      );
    }
  }

  const importMetaTarget =
    target.import && target.import.meta && target.import.meta.env
      ? target.import.meta
      : null;

  if (importMetaTarget) {
    importMetaTarget.env = {
      ...importMetaTarget.env,
      ...env,
    };
  } else {
    target.import = {
      meta: { env },
    };
  }

  return env;
};

export default loadViteTestEnv;
