import { beforeEach, describe, expect, it, vi } from 'vitest';

const storedValues = new Map<string, unknown>();

// storageAdapter is where the app READS its local collections from, so the
// seed has to go through it. These stubs stand in for that store.
vi.mock('../services/storageAdapter', () => ({
  storageAdapter: {
    get: vi.fn(async (key: string) => storedValues.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      storedValues.set(key, value);
    })
  },
  STORAGE_KEYS: {
    ACCOUNTS: 'wealthtracker_accounts',
    TRANSACTIONS: 'wealthtracker_transactions',
    BUDGETS: 'wealthtracker_budgets',
    GOALS: 'wealthtracker_goals',
    CATEGORIES: 'wealthtracker_categories',
    RECURRING: 'wealthtracker_recurring'
  }
}));

import { demoAccounts, initializeDemoData, isDemoMode, isDemoModeRuntimeAllowed } from './demoData';
import { storageAdapter } from '../services/storageAdapter';

const env = import.meta.env as Record<string, string | boolean | undefined>;
const originalMode = env.MODE;
const originalDev = env.DEV;
const originalProd = env.PROD;
const originalLocation = window.location.pathname + window.location.search;

const enterDemoMode = (): void => {
  env.MODE = 'test';
  env.DEV = true;
  env.PROD = false;
  window.history.replaceState({}, '', '/dashboard?demo=true');
};

describe('demoData runtime gating', () => {
  beforeEach(() => {
    env.MODE = originalMode;
    env.DEV = originalDev;
    env.PROD = originalProd;
    window.localStorage.clear();
    window.history.replaceState({}, '', originalLocation);
    storedValues.clear();
    vi.clearAllMocks();
  });

  it('allows demo mode in test/development runtime when query flag is present', () => {
    enterDemoMode();

    expect(isDemoMode()).toBe(true);
  });

  it('blocks demo mode in production runtime even when query flag is present', () => {
    env.MODE = 'production';
    env.DEV = false;
    env.PROD = true;
    window.history.replaceState({}, '', '/dashboard?demo=true');

    expect(isDemoMode()).toBe(false);
  });

  it('does not initialize demo data in production runtime', async () => {
    env.MODE = 'production';
    env.DEV = false;
    env.PROD = true;
    window.history.replaceState({}, '', '/dashboard?demo=true');

    await initializeDemoData();

    expect(window.localStorage.getItem('demoMode')).toBeNull();
    expect(storageAdapter.set).not.toHaveBeenCalled();
  });
});

describe('initializeDemoData seeding', () => {
  beforeEach(() => {
    window.localStorage.clear();
    storedValues.clear();
    vi.clearAllMocks();
    enterDemoMode();
  });

  it('seeds every collection through the storage the app reads from', async () => {
    await initializeDemoData();

    expect(storedValues.get('wealthtracker_accounts')).toEqual(demoAccounts);
    expect(storedValues.get('wealthtracker_transactions')).toHaveLength(100);
    expect(storedValues.get('wealthtracker_categories')).toBeDefined();
    expect(storedValues.get('wealthtracker_budgets')).toBeDefined();
    expect(storedValues.get('wealthtracker_goals')).toBeDefined();
    expect(storedValues.get('wealthtracker_recurring')).toBeDefined();
    expect(window.localStorage.getItem('demoMode')).toBe('true');
  });

  it('re-seeds when storage holds an empty account list', async () => {
    // The dead state this fixes: something (Clear All Data) left an empty
    // array behind, which used to shadow the seed forever.
    storedValues.set('wealthtracker_accounts', []);

    await initializeDemoData();

    expect(storedValues.get('wealthtracker_accounts')).toEqual(demoAccounts);
  });

  it('leaves an existing demo session alone', async () => {
    storedValues.set('wealthtracker_accounts', [{ id: 'edited-by-the-visitor' }]);

    await initializeDemoData();

    expect(storedValues.get('wealthtracker_accounts')).toEqual([{ id: 'edited-by-the-visitor' }]);
    expect(storageAdapter.set).not.toHaveBeenCalled();
  });

  it('gives every demo account a stable id, so reloading keeps the same accounts', () => {
    // Generated ids changed on every page load, which quietly orphaned
    // anything keyed by account id (archive overrides, saved balances, links).
    expect(demoAccounts.map(account => account.id)).toEqual([
      'demo-account-checking',
      'demo-account-savings',
      'demo-account-investment',
      'demo-account-credit'
    ]);
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
