/**
 * The boot's realtime subscription, and who closes it.
 *
 * The provider opens ONE subscription at the end of a signed-in boot —
 * `dataPort.subscribeToUpdates`, carrying both the account and the transaction
 * callbacks behind a single handle. It used to open two, through two different
 * services, and close them through two handles; the account half has been
 * folded into the same call, so "how many handles are there" is itself part of
 * what this suite pins.
 *
 * It is opened inside an ASYNC function, and React only accepts a cleanup
 * returned SYNCHRONOUSLY from the effect body, so the cleanup that used to be
 * returned from inside that function went into a promise nobody read. Nothing
 * ever closed it: switching account left the previous login's channels live,
 * still calling setAccounts on a provider that had moved on, and every re-mount
 * added another one.
 *
 * Three things are pinned here:
 *
 *  1. A signed-in boot subscribes ONCE, with both callbacks, and a user change
 *     closes the first login's handle EXACTLY once — not zero times (the leak),
 *     not twice (a double-invoked handle is a different bug wearing the same
 *     clothes).
 *  2. A cleanup that fires while the boot is still in flight has no handle to
 *     call yet. It must not throw, and the subscription that lands a moment
 *     later must be closed on arrival rather than left open forever. The handle
 *     arrives synchronously now, but everything BEFORE it in the boot is
 *     awaited, so the race is exactly as reachable as it was.
 *  3. An account change reloads the accounts through the seam — never through
 *     the account service the subscription used to come from.
 *
 * The data layer is stubbed the way the sibling suites stub it (in-memory
 * storage, local-only ids, no network). Only the seam's `realtime` capability
 * is forced on, because it is the sole gate on the realtime block — it was a
 * boolean called `isUsingSupabase` when this suite was written, and the same
 * predicate under a name that says what it governs now.
 */

import React, { ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Account } from '../../types';
import type { AccountBalanceSnapshot } from '../../services/port';

// Restore the live module (setup.ts registers a global mock for it).
vi.unmock('../AppContextSupabase');

/** The handle the app is given to close its subscription with. */
type Unsubscribe = () => void;

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

/**
 * The account service's own account read, counted rather than merely stubbed:
 * half of "the reload goes through the seam" is proving this one was not
 * called.
 *
 * `subscribeToAccountChanges` is deliberately NOT stubbed here any more. The
 * provider has no business calling it, and a mocked module that does not export
 * it fails loudly if that ever changes back.
 */
const simpleAccounts = vi.hoisted(() => ({
  // Type-only reference to `Account`: annotations are erased, so naming the
  // app's own type here costs nothing at the hoisted call site.
  getAccounts: vi.fn(async (): Promise<Account[]> => []),
}));

vi.mock('../../services/api/simpleAccountService', () => ({
  getAccounts: simpleAccounts.getAccounts,
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

/** Exactly what the provider may pass — no second copy of the shape. */
type UpdateCallbacks = Parameters<typeof DataService.subscribeToUpdates>[0];

/** A subscription the app asked for, plus the test's grip on it. */
interface OpenedSubscription {
  /**
   * Which login's boot opened it. The seam resolves its own owner, so the
   * subscription no longer carries a login the way the retired call did — the
   * test records the login whose boot asked for it, which is what that
   * assertion always meant. Without it the leak is invisible.
   */
  openedFor: string;
  /** What the provider subscribed with — one call must carry both. */
  callbacks: UpdateCallbacks;
  /** How many times the app has closed it. Exactly-once lives here. */
  unsubscribeCalls: number;
}

const localUserIds = {
  ensureUserExists: vi.fn(),
  getCurrentDatabaseUserId: () => null,
  getCurrentUserIds: () => ({ clerkId: 'clerk-user-a', databaseId: null }),
};

const wrapper = ({ children }: { children: ReactNode }) => <AppProvider>{children}</AppProvider>;

describe('the boot’s realtime subscription', () => {
  const subscriptions: OpenedSubscription[] = [];

  beforeEach(() => {
    memoryStore.clear();
    subscriptions.length = 0;
    simpleAccounts.getAccounts.mockClear();
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
    //
    // The whole descriptor is answered rather than just the gate: it is one
    // object, the context reads other fields of it elsewhere in the same boot,
    // and a stub that returned only `realtime` would be a shape no engine has.
    vi.spyOn(DataService, 'capabilities').mockReturnValue({
      edition: 'cloud',
      session: 'ready',
      realtime: true,
      maxConcurrentWrites: 8,
      backupTarget: 'login',
    });

    vi.spyOn(DataService, 'subscribeToUpdates').mockImplementation(
      (callbacks): Unsubscribe => {
        const subscription: OpenedSubscription = {
          openedFor: clerk.current.user.id,
          callbacks,
          unsubscribeCalls: 0,
        };
        subscriptions.push(subscription);
        return () => {
          subscription.unsubscribeCalls += 1;
        };
      }
    );
  });

  afterEach(() => {
    // Hand the singleton back its real dependencies; it outlives a test.
    DataService.configure({});
    vi.restoreAllMocks();
  });

  it('subscribes once, and closes the first login’s handle exactly once when the user changes', async () => {
    const { rerender, unmount } = renderHook(() => useApp(), { wrapper });

    await waitFor(() => expect(subscriptions).toHaveLength(1));
    const [first] = subscriptions;
    expect(first.openedFor).toBe('clerk-user-a');
    expect(first.unsubscribeCalls).toBe(0);

    // ONE call carrying BOTH channels. Two calls would be the arrangement this
    // slice removed: two handles, two teardowns, and two chances to leak one.
    expect(typeof first.callbacks.onAccountUpdate).toBe('function');
    expect(typeof first.callbacks.onTransactionUpdate).toBe('function');

    // Somebody else signs in. React re-runs the effect, and its cleanup is the
    // ONLY thing that can close what the previous boot opened.
    clerk.current = { user: clerk.userB, isLoaded: true };
    rerender();

    await waitFor(() => expect(subscriptions).toHaveLength(2));
    expect(subscriptions[1].openedFor).toBe('clerk-user-b');

    // The leak, stated: without a cleanup this is 0 and the first login's
    // channels keep pushing rows into the second login's provider.
    expect(first.unsubscribeCalls).toBe(1);
    // ...and the current login's subscription is still open.
    expect(subscriptions[1].unsubscribeCalls).toBe(0);

    // Unmounting closes the second one, and must not touch the first again:
    // a handle invoked twice is its own bug.
    unmount();
    expect(first.unsubscribeCalls).toBe(1);
    expect(subscriptions[1].unsubscribeCalls).toBe(1);
  });

  it('closes a subscription that arrives after the cleanup already ran', async () => {
    // The handle is handed over synchronously now, so the race has to be staged
    // where it actually lives: on the awaits BEFORE it. The balances round trip
    // is the last one the boot waits for — park it, and the cleanup fires at
    // the one moment there is nothing yet to close.
    let releaseBalances!: () => void;
    const parked = new Promise<void>(resolve => {
      releaseBalances = resolve;
    });
    const balances = vi.spyOn(DataService, 'getAccountBalances').mockImplementation(async () => {
      await parked;
      return new Map<string, AccountBalanceSnapshot>();
    });

    const { unmount } = renderHook(() => useApp(), { wrapper });

    // Parked, and provably so: the read the boot is waiting on has been asked
    // and has not answered. Nothing has been subscribed yet.
    await waitFor(() => expect(balances).toHaveBeenCalled());
    expect(subscriptions).toHaveLength(0);

    unmount();

    // The subscription lands on a provider that has gone. It is still created —
    // the boot resumes where it stopped — and it must be closed immediately
    // rather than surviving the component that asked for it.
    await act(async () => {
      releaseBalances();
      await Promise.resolve();
    });

    await waitFor(() => expect(subscriptions).toHaveLength(1));
    await waitFor(() => expect(subscriptions[0].unsubscribeCalls).toBe(1));
  });

  it('reloads the accounts through the seam when a change arrives', async () => {
    // WHICH door the reload goes through, stated as a test rather than left to
    // the diff. The account service's version carried a captured Clerk id and
    // re-resolved it on every event; the seam reads the id the boot resolved.
    // Both answer the same question today — the point of pinning it is that
    // only one of them can still be answering the PREVIOUS login's question.
    const portAccounts = vi.spyOn(DataService, 'getAccounts');

    renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(subscriptions).toHaveLength(1));

    // The boot has its own account read; this test is about the reload.
    portAccounts.mockClear();
    simpleAccounts.getAccounts.mockClear();

    const [subscription] = subscriptions;
    await act(async () => {
      subscription.callbacks.onAccountUpdate?.({
        eventType: 'UPDATE',
        new: { is_active: true },
      });
      // The reload is debounced by 200ms inside the provider. Waited out in
      // real time rather than with fake timers: the boot around it is a chain
      // of awaits, and freezing the clock under it buys nothing here.
      await new Promise(resolve => setTimeout(resolve, 300));
    });

    await waitFor(() => expect(portAccounts).toHaveBeenCalledTimes(1));
    expect(simpleAccounts.getAccounts).not.toHaveBeenCalled();
  });
});
