export interface RuntimeModeEnv {
  DEV?: boolean;
  MODE?: string;
  PROD?: boolean;
}

interface RuntimeStorageLike {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

interface RuntimeSessionStorageLike {
  setItem(key: string, value: string): void;
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
const RUNTIME_CONTROL_SANITIZATION_SIGNAL_KEY = 'wealthtracker.runtime_control_sanitization';

export type RuntimeControlQueryParam = typeof RUNTIME_CONTROL_QUERY_PARAMS[number];
export type RuntimeControlStorageKey = typeof RUNTIME_CONTROL_STORAGE_KEYS[number];

export interface RuntimeControlSearchSanitizationResult {
  sanitizedSearch: string;
  removedParams: RuntimeControlQueryParam[];
}

export interface RuntimeControlStorageSanitizationResult {
  removedAny: boolean;
  removedKeys: RuntimeControlStorageKey[];
}

export interface RuntimeControlSanitizationContext {
  removedQueryParams: RuntimeControlQueryParam[];
  removedStorageKeys: RuntimeControlStorageKey[];
  path: string;
}

export interface PersistedRuntimeControlSanitizationSignal extends RuntimeControlSanitizationContext {
  timestamp: string;
}

export const sanitizeRuntimeControlSearchWithDetails = (
  search: string,
  env: RuntimeModeEnv
): RuntimeControlSearchSanitizationResult => {
  const normalizedSearch = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(normalizedSearch);
  const removedParams: RuntimeControlQueryParam[] = [];

  if (!isDemoModeRuntimeAllowed(env)) {
    RUNTIME_CONTROL_QUERY_PARAMS.forEach((param) => {
      if (params.has(param)) {
        removedParams.push(param);
        params.delete(param);
      }
    });
  }

  const next = params.toString();
  return {
    sanitizedSearch: next ? `?${next}` : '',
    removedParams
  };
};

export const sanitizeRuntimeControlSearch = (search: string, env: RuntimeModeEnv): string => {
  return sanitizeRuntimeControlSearchWithDetails(search, env).sanitizedSearch;
};

export const sanitizeRuntimeControlStorageWithDetails = (
  env: RuntimeModeEnv,
  storage: RuntimeStorageLike | null | undefined
): RuntimeControlStorageSanitizationResult => {
  if (!storage || isRuntimeBypassAllowed(env)) {
    return {
      removedAny: false,
      removedKeys: []
    };
  }

  const removedKeys: RuntimeControlStorageKey[] = [];
  RUNTIME_CONTROL_STORAGE_KEYS.forEach((key) => {
    if (storage.getItem(key) !== null) {
      storage.removeItem(key);
      removedKeys.push(key);
    }
  });

  return {
    removedAny: removedKeys.length > 0,
    removedKeys
  };
};

export const sanitizeRuntimeControlStorage = (
  env: RuntimeModeEnv,
  storage: RuntimeStorageLike | null | undefined
): boolean => {
  return sanitizeRuntimeControlStorageWithDetails(env, storage).removedAny;
};

export const persistRuntimeControlSanitizationSignal = (
  context: RuntimeControlSanitizationContext,
  storage: RuntimeSessionStorageLike | null | undefined
): void => {
  if (!storage) {
    return;
  }

  const signal: PersistedRuntimeControlSanitizationSignal = {
    ...context,
    timestamp: new Date().toISOString()
  };

  try {
    storage.setItem(RUNTIME_CONTROL_SANITIZATION_SIGNAL_KEY, JSON.stringify(signal));
  } catch {
    // Ignore storage write failures so app bootstrap is never blocked.
  }
};
