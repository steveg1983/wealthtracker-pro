export type LoadViteTestEnvResult = Record<string, string | boolean>;

export interface LoadViteTestEnvSupabaseOptions {
  modeKey?: string;
  defaultMode?: string;
  requiredWhenReal?: string[];
}

export interface LoadViteTestEnvOptions {
  envFiles?: string[];
  defaultValues?: Record<string, string>;
  supabase?: LoadViteTestEnvSupabaseOptions;
  target?: { import?: { meta?: { env?: Record<string, string | boolean> } } };
}

export function loadViteTestEnv(
  options?: LoadViteTestEnvOptions,
): LoadViteTestEnvResult;

export * from './supabaseRealTest';
export * from './supabaseMock';
export * from './supabaseFixtures';
export * from './realDatabase';
