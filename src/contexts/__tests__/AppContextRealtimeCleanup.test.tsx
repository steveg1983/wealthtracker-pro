/**
 * The boot's realtime channels, and who closes them.
 *
 * The provider opens two subscriptions at the end of a signed-in boot — the
 * account channel (SimpleAccountService) and the transaction channel
 * (DataService.subscribeToUpdates). They are opened inside an ASYNC function,
 * and React only accepts a cleanup returned SYNCHRONOUSLY from the effect
 * body, so the cleanup that used to be returned from inside that function went
 * into a promise nobody read. Nothing ever closed them: switching account left
 * the previous login's channels live, still calling setAccounts on a provider
 * that had moved on, and every re-mount added another pair.
 *
 * Two things are pinned here, and they are the two the fix has to get right:
 *
 *  1. A user change closes the first login's channels EXACTLY once — not zero
 *     times (the leak), not twice (a double-invoked handle is a different bug
 *     wearing the same clothes).
 *  2. A cleanup that fires while the boot is still in flight has no handle to
 *     call yet. It must not throw, and the subscription that lands a moment
 *     later must be closed on arrival rather than left open forever.
 *
 * The data layer is stubbed the way the sibling suites stub it (in-memory
 * storage, local-only ids, no network). Only `isUsingSupabase` is forced on,
 * because that flag is the sole gate on the realtime block.
 */

import React, { ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Account } from '../../types';

// Restore the live module (setup.ts registers a global mock for it).
vi.unmock('../AppContextSupabase');

/** The handle the app is given to close a channel with. */
type Unsubscribe = () => void;

/** An account channel the app asked for, plus the test's grip on it. */
interface OpenedAccountChannel {
  /** Which login the channel belongs to — the leak is invisible without this. */
  clerkId: string;
  /** How many times the app has closed it. Exactly-once lives here. */
  unsubscribeCalls: number;
  /**
   * Hands the app its unsubscribe handle, i.e. resolves the subscribe promise.
   * Held back deliberately in the race test so the boot parks mid-flight.
   */
  open: () => void;
}

/** A transaction channel, which is handed over synchronously. */
interface OpenedDataChannel {
  unsubscribeCalls: number;
}

// Two logins, each a stable singleton: the boot effect depends on `user`, so a
// fresh object per render would re-fire it forever.
const clerk = vi.hoisted(() => {
  const userA = {
    id: 'clerk-user-a',
    emailAddresses: [{ emailAddress: 'first@example.com' }],
    firstName: 'First',
    lastName: 'Login',
  };
  const userB = {
    id: 'clerk-user-b',
    emailAddresses: [{ emailAddress: 'second@example.com' }],
    firstName: 'Second',
    lastName: 'Login',
  };
  return { userA, userB, current: { user: userA, isLoaded: true } };
});

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => clerk.current,
  useAuth: () => ({ signOut: vi.fn(), getToken: vi.fn() }),
  useSession: () => ({ session: null }),
}));

const accountChannels = vi.hoisted(() => ({
  opened: [] as OpenedAccountChannel[],
  /** False parks every subscribe promise so a boot can be caught mid-flight. */
  autoOpen: true,
}));

vi.mock('../../services/api/simpleAccountService', () => ({
  getAccounts: async (): Promise<Account[]> => [],
  subscribeToAccountChanges: (
    clerkId: string,
    _onChange: (payload: unknown) => void
  ): Promise<Unsubscribe> => {
    let handOver!: (unsubscribe: Unsubscribe) => void;
    const subscribed = new Promise<Unsubscribe>(resolve => {
      handOver = resolve;
    });
    const channel: OpenedAccountChannel = {
      clerkId,
      unsubscribeCalls: 0,
      open: () =>
        handOver(() => {
          channel.unsubscribeCalls += 1;
        }),
    };
    accountChannels.opened.push(channel);
    if (accountChannels.autoOpen) channel.open();
    return subscribed;
  },
}));

// The in-memory store behind the local fallback.
const memoryStore = vi.hoisted(() => new Map<string, unknown>());

vi.mock('../../services/storageAdapter', () => {
  const adapter = {
    get: async <T,>(key: string): Promise<T | null> =>
      memoryStore.has(key) ? (memoryStore.get(key) as T) : null,
    set: async (key: string, value: unknown): Promise<void> => {
      memoryStore.set(key, value);
    },
    remove: async (key: string): Promise<void> => {
      memoryStore.delete(key);
    },
    clear: async (): Promise<void> => {
      memoryStore.clear();
    },
  };
  return {
    storageAdapter: adapter,
    default: adapter,
    STORAGE_KEYS: {
      ACCOUNTS: 'wealthtracker_accounts',
      TRANSACTIONS: 'wealthtracker_transactions',
      TRANSACTION_SPLITS: 'wealthtracker_transaction_splits',
      BUDGETS: 'wealthtracker_budgets',
      GOALS: 'wealthtracker_goals',
      TAGS: 'wealthtracker_tags',
      RECURRING: 'wealthtracker_recurring',
      CATEGORIES: 'wealthtracker_categories',
      SUGGESTION_DISMISSALS: 'wealthtracker_suggestion_dismissals',
      PREFERENCES: 'wealthtracker_preferences',
    },
  };
});

// The database id resolves (so the boot takes its signed-in branch) but the
// CURRENT id stays null, which keeps every service on its local path and off
// the network — the same trick the sibling suites use.
vi.mock('../../services/userIdService', () => ({
  userIdService: {
    ensureUserExists: async (): Promise<string> => 'db-user-1',
    getCurrentDatabaseUserId: (): string | null => null,
    getCurrentClerkId: (): string | null => 'clerk-user-a',
    getCurrentUserIds: (): { clerkId: string | null; databaseId: string | null } => ({
      clerkId: 'clerk-user-a',
      databaseId: null,
    }),
    getDatabaseUserId: async (): Promise<string> => 'db-user-1',
    clearCache: (): void => {},
  },
}));

vi.mock('../../services/autoSyncService', () => ({
  default: { initialize: async (): Promise<void> => {} },
}));

import { AppProvider, useApp } from '../AppContextSupabase';
import { DataService } from '../../services/api/dataService';

const localUserIds = {
  ensureUserExists: vi.fn(),
  getCurrentDatabaseUserId: () => null,
  getCurrentUserIds: () => ({ clerkId: 'clerk-user-a', databaseId: null }),
};

const wrapper = ({ children }: { children: ReactNode }) => <AppProvider>{children}</AppProvider>;

describe('the boot’s realtime channels', () => {
  const dataChannels: OpenedDataChannel[] = [];

  beforeEach(() => {
    memoryStore.clear();
    accountChannels.opened.length = 0;
    accountChannels.autoOpen = true;
    dataChannels.length = 0;
    clerk.current = { user: clerk.userA, isLoaded: true };

    // Local-only data layer: storage-backed reads, no cloud client anywhere.
    DataService.configure({
      isSupabaseConfigured: () => false,
      hasCloudSession: () => false,
      storageAdapter: {
        get: async <T,>(key: string): Promise<T | null> =>
          memoryStore.has(key) ? (memoryStore.get(key) as T) : null,
        set: async (key: string, value: unknown): Promise<void> => {
          memoryStore.set(key, value);
        },
      },
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
      userIdService: localUserIds,
    });

    // The one gate on the realtime block. Forced rather than arranged, because
    // arranging it (a real database id + a configured client) would put the
    // rest of the boot on the network for no gain to what is under test.
    vi.spyOn(DataService, 'isUsingSupabase').mockReturnValue(true);

    vi.spyOn(DataService, 'subscribeToUpdates').mockImplementation((): Unsubscribe => {
      const channel: OpenedDataChannel = { unsubscribeCalls: 0 };
      dataChannels.push(channel);
      return () => {
        channel.unsubscribeCalls += 1;
      };
    });
  });

  afterEach(() => {
    // Hand the singleton back its real dependencies; it outlives a test.
    DataService.configure({});
    vi.restoreAllMocks();
  });

  it('closes the first login’s channels exactly once when the user changes', async () => {
    const { rerender, unmount } = renderHook(() => useApp(), { wrapper });

    // Both channels are open for the first login. Waiting on the transaction
    // channel is enough: it is created last, and the handles are registered in
    // the same synchronous step.
    await waitFor(() => expect(dataChannels).toHaveLength(1));
    const [firstAccountChannel] = accountChannels.opened;
    const [firstDataChannel] = dataChannels;
    expect(firstAccountChannel.clerkId).toBe('clerk-user-a');
    expect(firstAccountChannel.unsubscribeCalls).toBe(0);

    // Somebody else signs in. React re-runs the effect, and its cleanup is the
    // ONLY thing that can close what the previous boot opened.
    clerk.current = { user: clerk.userB, isLoaded: true };
    rerender();

    await waitFor(() => expect(dataChannels).toHaveLength(2));
    expect(accountChannels.opened[1].clerkId).toBe('clerk-user-b');

    // The leak, stated: without a cleanup these are 0 and the first login's
    // channels keep pushing rows into the second login's provider.
    expect(firstAccountChannel.unsubscribeCalls).toBe(1);
    expect(firstDataChannel.unsubscribeCalls).toBe(1);
    // ...and the current login's channels are still open.
    expect(accountChannels.opened[1].unsubscribeCalls).toBe(0);
    expect(dataChannels[1].unsubscribeCalls).toBe(0);

    // Unmounting closes the second pair, and must not touch the first again:
    // a handle invoked twice is its own bug.
    unmount();
    expect(firstAccountChannel.unsubscribeCalls).toBe(1);
    expect(firstDataChannel.unsubscribeCalls).toBe(1);
    expect(accountChannels.opened[1].unsubscribeCalls).toBe(1);
    expect(dataChannels[1].unsubscribeCalls).toBe(1);
  });

  it('closes channels that arrive after the cleanup already ran', async () => {
    // The account subscription is a round trip. Park it, so the cleanup fires
    // at the one moment there is nothing yet to close.
    accountChannels.autoOpen = false;

    const { unmount } = renderHook(() => useApp(), { wrapper });

    await waitFor(() => expect(accountChannels.opened).toHaveLength(1));
    const [channel] = accountChannels.opened;
    // The boot is parked on the await: the handle does not exist yet.
    expect(dataChannels).toHaveLength(0);

    unmount();
    expect(channel.unsubscribeCalls).toBe(0);

    // The subscription lands on a provider that has gone. Both channels are
    // created — the boot resumes where it stopped — and both must be closed
    // immediately rather than surviving the component that asked for them.
    await act(async () => {
      channel.open();
      await Promise.resolve();
    });

    await waitFor(() => expect(dataChannels).toHaveLength(1));
    expect(channel.unsubscribeCalls).toBe(1);
    expect(dataChannels[0].unsubscribeCalls).toBe(1);
  });
});
