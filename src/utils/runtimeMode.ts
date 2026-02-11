export interface RuntimeModeEnv {
  DEV?: boolean;
  MODE?: string;
  PROD?: boolean;
}

interface RuntimeStorageLike {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

const isProductionRuntime = (env: RuntimeModeEnv): boolean =>
  env.PROD === true || env.MODE === 'production';

export const isRuntimeBypassAllowed = (env: RuntimeModeEnv): boolean => {
  if (isProductionRuntime(env)) {
    return false;
  }
  return env.DEV === true || env.MODE === 'development' || env.MODE === 'test';
};

export const isDemoModeRuntimeAllowed = isRuntimeBypassAllowed;
export const isAuthBypassRuntimeAllowed = isRuntimeBypassAllowed;

const RUNTIME_CONTROL_QUERY_PARAMS = ['demo', 'testMode'] as const;
const RUNTIME_CONTROL_STORAGE_KEYS = ['isTestMode', 'demoMode'] as const;

export const sanitizeRuntimeControlSearch = (search: string, env: RuntimeModeEnv): string => {
  const normalizedSearch = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(normalizedSearch);

  if (!isDemoModeRuntimeAllowed(env)) {
    RUNTIME_CONTROL_QUERY_PARAMS.forEach((param) => params.delete(param));
  }

  const next = params.toString();
  return next ? `?${next}` : '';
};

export const sanitizeRuntimeControlStorage = (
  env: RuntimeModeEnv,
  storage: RuntimeStorageLike | null | undefined
): boolean => {
  if (!storage || isRuntimeBypassAllowed(env)) {
    return false;
  }

  let removedAny = false;
  RUNTIME_CONTROL_STORAGE_KEYS.forEach((key) => {
    if (storage.getItem(key) !== null) {
      storage.removeItem(key);
      removedAny = true;
    }
  });
  return removedAny;
};
