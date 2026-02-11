import { beforeEach, describe, expect, it } from 'vitest';
import { initializeDemoData, isDemoMode, isDemoModeRuntimeAllowed } from './demoData';

const env = import.meta.env as Record<string, string | boolean | undefined>;
const originalMode = env.MODE;
const originalDev = env.DEV;
const originalProd = env.PROD;
const originalLocation = window.location.pathname + window.location.search;

describe('demoData runtime gating', () => {
  beforeEach(() => {
    env.MODE = originalMode;
    env.DEV = originalDev;
    env.PROD = originalProd;
    window.localStorage.clear();
    window.history.replaceState({}, '', originalLocation);
  });

  it('allows demo mode in test/development runtime when query flag is present', () => {
    env.MODE = 'test';
    env.DEV = true;
    env.PROD = false;
    window.history.replaceState({}, '', '/dashboard?demo=true');

    expect(isDemoMode()).toBe(true);
  });

  it('blocks demo mode in production runtime even when query flag is present', () => {
    env.MODE = 'production';
    env.DEV = false;
    env.PROD = true;
    window.history.replaceState({}, '', '/dashboard?demo=true');

    expect(isDemoMode()).toBe(false);
  });

  it('does not initialize demo data in production runtime', () => {
    env.MODE = 'production';
    env.DEV = false;
    env.PROD = true;
    window.history.replaceState({}, '', '/dashboard?demo=true');

    initializeDemoData();

    expect(window.localStorage.getItem('demoMode')).toBeNull();
    expect(window.localStorage.getItem('accounts')).toBeNull();
    expect(window.localStorage.getItem('transactions')).toBeNull();
  });
});

describe('isDemoModeRuntimeAllowed', () => {
  it('returns false for production env', () => {
    expect(isDemoModeRuntimeAllowed({ MODE: 'production', DEV: false, PROD: true })).toBe(false);
  });

  it('returns true for development env', () => {
    expect(isDemoModeRuntimeAllowed({ MODE: 'development', DEV: true, PROD: false })).toBe(true);
  });

  it('returns true for test env', () => {
    expect(isDemoModeRuntimeAllowed({ MODE: 'test', DEV: false, PROD: false })).toBe(true);
  });
});
