import { describe, it, expect, vi } from 'vitest';
import {
  PREFERENCES_DOCUMENT_VERSION,
  PORTABLE_PREFERENCE_KEYS,
  PreferencesService,
  parsePreferencesDocument,
  periodPreferenceKeys,
  type LocalMirror,
  type PreferencesDocument,
  type PreferencesTransport,
} from './preferencesService';

/**
 * Every value here is invented. The keys are the app's real ones because the
 * behaviour under test is about WHICH keys travel, and a made-up key would let
 * a registry mistake pass.
 */

/** A browser mirror that can be inspected, and made to fail like Safari's does. */
function mirror(initial: Record<string, string> = {}): LocalMirror & { values: Record<string, string> } {
  const values = { ...initial };
  return {
    values,
    getItem: (key) => (key in values ? values[key] : null),
    setItem: (key, value) => { values[key] = value; },
    removeItem: (key) => { delete values[key]; },
  };
}

/** A store standing in for the row, with every call recorded. */
function transport(initial: PreferencesDocument | null = null): PreferencesTransport & {
  row: PreferencesDocument | null;
  writes: PreferencesDocument[];
  reads: string[];
} {
  const state = {
    row: initial,
    writes: [] as PreferencesDocument[],
    reads: [] as string[],
    read: async (userId: string) => { state.reads.push(userId); return state.row; },
    write: async (_userId: string, document: PreferencesDocument) => {
      state.writes.push(document);
      state.row = document;
    },
  };
  return state;
}

/** No timers: every scheduled write fires at once, so `flush` is enough. */
const immediate = { debounceMs: 0 };

describe('parsePreferencesDocument', () => {
  it('keeps a key this build has never heard of', () => {
    // The property that makes one document safe for two client versions at
    // once: an older client must not be able to drop a newer one's preference.
    const parsed = parsePreferencesDocument({
      version: 1,
      values: { 'something.from.2027': 'on', dashboardKeyAccounts: '["a-1"]' },
    });
    expect(parsed.values['something.from.2027']).toBe('on');
  });

  it('keeps a version it does not recognise, rather than resetting the document', () => {
    expect(parsePreferencesDocument({ version: 9, values: {} }).version).toBe(9);
  });

  it('drops a value that is not a string, because nothing could consume it', () => {
    const parsed = parsePreferencesDocument({ version: 1, values: { a: 'x', b: 42, c: null } });
    expect(parsed.values).toEqual({ a: 'x' });
  });

  it('reads junk as an empty document instead of throwing', () => {
    expect(parsePreferencesDocument(null).values).toEqual({});
    expect(parsePreferencesDocument('nonsense').values).toEqual({});
    expect(parsePreferencesDocument([1, 2, 3]).values).toEqual({});
    expect(parsePreferencesDocument({ version: 1, values: 'not an object' }).values).toEqual({});
  });
});

describe('the registry', () => {
  it('covers all four keys of every period surface', () => {
    // usePeriod writes four keys per surface and all four have to travel, or a
    // restored custom range comes back as an empty one nobody asked for.
    for (const key of periodPreferenceKeys('dashboardReports')) {
      expect(PORTABLE_PREFERENCE_KEYS).toContain(key);
    }
  });

  it('leaves device state out — column widths and the last sync stay put', () => {
    expect(PORTABLE_PREFERENCE_KEYS).not.toContain('accountRegister.columnWidths.v1');
    expect(PORTABLE_PREFERENCE_KEYS.some(key => key.startsWith('bankAutoSync:lastRun'))).toBe(false);
    expect(PORTABLE_PREFERENCE_KEYS).not.toContain('onboardingCompleted');
  });

  it('lists no key twice', () => {
    expect(new Set(PORTABLE_PREFERENCE_KEYS).size).toBe(PORTABLE_PREFERENCE_KEYS.length);
  });
});

describe('reading before the account has spoken', () => {
  it('answers from this browser, so nothing is forgotten on the first boot', () => {
    // The whole point of the fall-through: every setting the user already has
    // is in browser storage under exactly these keys.
    const service = new PreferencesService({
      mirror: mirror({ accountsSortMode: 'balance-desc' }),
      transport: null,
      ...immediate,
    });
    expect(service.getItem('accountsSortMode')).toBe('balance-desc');
  });

  it('stops answering from this browser once the account has', async () => {
    // A key absent from the stored document is absent — the user removed that
    // preference, possibly elsewhere — and resurrecting this browser's leftover
    // copy every boot is exactly the bug "my settings follow me" must not have.
    const browser = mirror({ accountsSortMode: 'balance-desc' });
    const store = transport({ version: 1, values: { accountsGroupBy: 'type' } });
    const service = new PreferencesService({ mirror: browser, transport: store, ...immediate });

    await service.attach('user-1');

    expect(service.getItem('accountsGroupBy')).toBe('type');
    expect(service.getItem('accountsSortMode')).toBeNull();
  });
});

describe('the one-time lift', () => {
  it('writes this browser\'s existing settings up as the row\'s first content', async () => {
    const browser = mirror({
      dashboardKeyAccounts: '["a-1","a-2"]',
      money_management_currency: 'GBP',
      // Not registered, so the lift does not carry it. It would still travel if
      // something wrote it THROUGH the service; the registry only drives this.
      'some.device.thing': 'x',
    });
    const store = transport(null);
    const service = new PreferencesService({ mirror: browser, transport: store, ...immediate });

    await service.attach('user-1');
    await service.flush();

    expect(store.writes).toHaveLength(1);
    expect(store.writes[0].values.dashboardKeyAccounts).toBe('["a-1","a-2"]');
    expect(store.writes[0].values.money_management_currency).toBe('GBP');
    expect(store.writes[0].values['some.device.thing']).toBeUndefined();
    expect(store.writes[0].version).toBe(PREFERENCES_DOCUMENT_VERSION);
  });

  it('does not lift over a value changed while the read was in flight', async () => {
    const browser = mirror({ accountsSortMode: 'name' });
    const store = transport(null);
    const service = new PreferencesService({ mirror: browser, transport: store, ...immediate });

    // The user clicks before the row comes back. Their click is newer.
    service.setItem('accountsSortMode', 'balance-asc');
    await service.attach('user-1');
    await service.flush();

    expect(service.getItem('accountsSortMode')).toBe('balance-asc');
    expect(store.row?.values.accountsSortMode).toBe('balance-asc');
  });

  it('lifts nothing from an empty browser, and still creates the row', async () => {
    const store = transport(null);
    const service = new PreferencesService({ mirror: mirror(), transport: store, ...immediate });

    await service.attach('user-1');
    await service.flush();

    expect(store.writes).toHaveLength(1);
    expect(store.writes[0].values).toEqual({});
  });
});

describe('loading an existing row', () => {
  it('lets the account outrank this browser, and refreshes the browser to match', async () => {
    // A machine not opened for a month must not push its month-old toggles over
    // the ones set since.
    const browser = mirror({ money_management_currency: 'USD' });
    const store = transport({ version: 1, values: { money_management_currency: 'EUR' } });
    const service = new PreferencesService({ mirror: browser, transport: store, ...immediate });

    await service.attach('user-1');

    expect(service.getItem('money_management_currency')).toBe('EUR');
    expect(browser.values.money_management_currency).toBe('EUR');
  });

  it('keeps this browser\'s copy when the row cannot be read', async () => {
    // A database without the migration applied yet, or an offline boot. Both
    // survivable: the mirror is where all of this lived until now.
    const browser = mirror({ accountsSortMode: 'name' });
    const failing: PreferencesTransport = {
      read: () => Promise.reject(new Error('relation "user_preferences" does not exist')),
      write: () => Promise.resolve(),
    };
    const service = new PreferencesService({ mirror: browser, transport: failing, ...immediate });

    await service.attach('user-1');

    expect(service.getItem('accountsSortMode')).toBe('name');
  });
});

describe('write-through', () => {
  it('reaches the browser at once and the account after the debounce', async () => {
    const browser = mirror();
    const store = transport({ version: 1, values: {} });
    const service = new PreferencesService({
      mirror: browser,
      transport: store,
      debounceMs: 5_000,
    });
    await service.attach('user-1');

    service.setItem('netWorthChartType', 'bar');

    // Immediately: the browser has it, so a reload with no network keeps it.
    expect(browser.values.netWorthChartType).toBe('bar');
    expect(store.writes).toHaveLength(0);

    await service.flush();
    expect(store.writes.at(-1)?.values.netWorthChartType).toBe('bar');
  });

  it('collapses a burst of changes into one write', async () => {
    const store = transport({ version: 1, values: {} });
    const service = new PreferencesService({ mirror: mirror(), transport: store, debounceMs: 5_000 });
    await service.attach('user-1');

    // Ticking six accounts in the dashboard picker is six setItems.
    for (const value of ['a', 'b', 'c', 'd', 'e', 'f']) {
      service.setItem('dashboardKeyAccounts', JSON.stringify([value]));
    }
    await service.flush();

    expect(store.writes).toHaveLength(1);
    expect(store.writes[0].values.dashboardKeyAccounts).toBe('["f"]');
  });

  it('writes nothing when the value has not actually changed', async () => {
    const store = transport({ version: 1, values: { netWorthShowDetail: '1' } });
    const service = new PreferencesService({ mirror: mirror(), transport: store, debounceMs: 5_000 });
    await service.attach('user-1');

    service.setItem('netWorthShowDetail', '1');
    await service.flush();

    expect(store.writes).toHaveLength(0);
  });

  it('keeps the setting for this session when the account write fails', async () => {
    const failing: PreferencesTransport = {
      read: () => Promise.resolve({ version: 1, values: {} }),
      write: () => Promise.reject(new Error('offline')),
    };
    const browser = mirror();
    const service = new PreferencesService({ mirror: browser, transport: failing, ...immediate });
    await service.attach('user-1');

    service.setItem('reportsPayeeSide', 'income');
    await service.flush();

    expect(service.getItem('reportsPayeeSide')).toBe('income');
    expect(browser.values.reportsPayeeSide).toBe('income');
  });

  it('survives a browser that refuses to store anything', async () => {
    // Safari private browsing throws on setItem. The preference must still hold
    // for this visit and still reach the account.
    const throwing: LocalMirror = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => { throw new Error('SecurityError'); },
    };
    const store = transport({ version: 1, values: {} });
    const service = new PreferencesService({ mirror: throwing, transport: store, ...immediate });
    await service.attach('user-1');

    service.setItem('reportsTrendChartType', 'bar');
    await service.flush();

    expect(service.getItem('reportsTrendChartType')).toBe('bar');
    expect(store.writes.at(-1)?.values.reportsTrendChartType).toBe('bar');
  });

  it('removes a preference from the account as well as the browser', async () => {
    const browser = mirror({ reportsAccountFilterIds: '["a-1"]' });
    const store = transport({ version: 1, values: { reportsAccountFilterIds: '["a-1"]' } });
    const service = new PreferencesService({ mirror: browser, transport: store, ...immediate });
    await service.attach('user-1');

    service.removeItem('reportsAccountFilterIds');
    await service.flush();

    expect(service.getItem('reportsAccountFilterIds')).toBeNull();
    expect(browser.values.reportsAccountFilterIds).toBeUndefined();
    expect(store.row?.values.reportsAccountFilterIds).toBeUndefined();
  });

  /**
   * A preference the document never held is still a preference the BROWSER
   * holds, and `getItem` reads the browser for anything the document is missing
   * until the account's row lands. So a removal that skipped the mirror did not
   * remove anything — it hid the key for this session and handed it back on the
   * next boot.
   *
   * The dashboard's period pins are where this drew blood. Releasing a pinned
   * card removes the five keys it owns, and the pin FLAG is removed last; when
   * the flag was in the browser but not in this session's document — a boot
   * that read before `attach` resolved, an offline boot, a session whose writes
   * never reached the server — the four keys carrying the WINDOW went and the
   * flag stayed. The card came back declaring itself pinned with no window to
   * be pinned to, which renders as a pin that changes nothing.
   */
  it('removes a preference the browser holds but the document never did', async () => {
    const browser = mirror({ 'dashboardReports.pin.net-worthPinned': 'true' });
    const store = transport({ version: 1, values: {} });
    const service = new PreferencesService({ mirror: browser, transport: store, ...immediate });
    await service.attach('user-1');

    service.removeItem('dashboardReports.pin.net-worthPinned');

    expect(browser.values['dashboardReports.pin.net-worthPinned']).toBeUndefined();
    expect(service.getItem('dashboardReports.pin.net-worthPinned')).toBeNull();
  });

  /** …and the same before the row has landed, where the mirror IS the store. */
  it('removes a browser-only preference before the account has spoken', () => {
    const browser = mirror({ 'dashboardReports.pin.net-worthPinned': 'true' });
    const service = new PreferencesService({ mirror: browser, transport: null });

    expect(service.getItem('dashboardReports.pin.net-worthPinned')).toBe('true');
    service.removeItem('dashboardReports.pin.net-worthPinned');

    expect(service.getItem('dashboardReports.pin.net-worthPinned')).toBeNull();
    expect(browser.values['dashboardReports.pin.net-worthPinned']).toBeUndefined();
  });

  it('does not write at all before a user is attached', async () => {
    const store = transport(null);
    const service = new PreferencesService({ mirror: mirror(), transport: store, ...immediate });

    service.setItem('accountsSortMode', 'name');
    await service.flush();

    expect(store.writes).toHaveLength(0);
  });
});

describe('signing out', () => {
  it('forgets the previous user, so their settings cannot be written into the next one\'s row', async () => {
    // The shared-browser case. attach() merges what is in memory on top of the
    // document it reads, so a document left over from user A would end up in
    // user B's row.
    const store = transport({ version: 1, values: { dashboardKeyAccounts: '["a-of-user-a"]' } });
    const service = new PreferencesService({ mirror: mirror(), transport: store, ...immediate });
    await service.attach('user-a');
    expect(service.getItem('dashboardKeyAccounts')).toBe('["a-of-user-a"]');

    service.detach();

    store.row = { version: 1, values: { dashboardKeyAccounts: '["a-of-user-b"]' } };
    await service.attach('user-b');
    await service.flush();

    expect(service.getItem('dashboardKeyAccounts')).toBe('["a-of-user-b"]');
    expect(store.row.values.dashboardKeyAccounts).toBe('["a-of-user-b"]');
  });
});

describe('changing which store the settings live in', () => {
  it('sends everything after it to the new store', async () => {
    // The desktop's whole reason for this method: the store is a property of
    // the SESSION there — a file that was chosen, opened and can be closed —
    // rather than of the build, and there is one service instance because every
    // surface in the app reads it.
    const cloud = transport({ version: 1, values: { accountsSortMode: 'name' } });
    const file = transport({ version: 1, values: { accountsSortMode: 'balance-desc' } });
    const service = new PreferencesService({ mirror: mirror(), transport: cloud, ...immediate });

    service.useTransport(file);
    await service.attach('11111111-1111-1111-1111-111111111111');
    service.setItem('accountsSortMode', 'balance-asc');
    await service.flush();

    expect(cloud.reads).toEqual([]);
    expect(cloud.writes).toEqual([]);
    expect(file.reads).toEqual(['11111111-1111-1111-1111-111111111111']);
    expect(file.row?.values.accountsSortMode).toBe('balance-asc');
  });

  it('does not deliver the previous store\'s queued write to the new one', async () => {
    // `scheduleWrite` resolves the transport when the TIMER fires, not when the
    // change was made — so without the detach inside `useTransport`, a burst of
    // changes made a moment before opening a file would be written INTO that
    // file, under the previous store's user id. That is the cross-account write
    // `detach` already exists to prevent on a shared browser; changing stores is
    // changing accounts, and is treated as one.
    const cloud = transport({ version: 1, values: {} });
    const file = transport(null);
    const service = new PreferencesService({
      mirror: mirror(),
      transport: cloud,
      debounceMs: 1000,
    });
    await service.attach('somebody-signed-in');
    service.setItem('accountsSortMode', 'balance-desc');

    service.useTransport(file);
    await service.flush();

    expect(file.writes).toEqual([]);
    expect(service.getDocument().values).toEqual({});
  });

  it('is a no-op when the store is the one already in use', async () => {
    // Called on every boot, and a boot that silently detached a live session
    // would throw away whatever had been set since it started.
    const file = transport({ version: 1, values: { accountsSortMode: 'name' } });
    const service = new PreferencesService({ mirror: mirror(), transport: file, ...immediate });
    await service.attach('user-1');
    service.setItem('netWorthChartType', 'bar');

    service.useTransport(file);

    expect(service.getItem('netWorthChartType')).toBe('bar');
    expect(service.getItem('accountsSortMode')).toBe('name');
  });
});

describe('subscribers', () => {
  it('are told when a value changes and when the account\'s document lands', async () => {
    const store = transport({ version: 1, values: { accountsSortMode: 'name' } });
    const service = new PreferencesService({ mirror: mirror(), transport: store, ...immediate });
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);

    await service.attach('user-1');
    expect(listener).toHaveBeenCalledTimes(1);

    service.setItem('accountsSortMode', 'balance-asc');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    service.setItem('accountsSortMode', 'name');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('hand out a new document object on every change, so React can compare it', () => {
    const service = new PreferencesService({ mirror: mirror(), transport: null, ...immediate });
    const before = service.getDocument();
    service.setItem('netWorthChartType', 'bar');
    expect(service.getDocument()).not.toBe(before);
  });
});

describe('replaceAll', () => {
  it('takes the whole document, mirrors it, and saves it at once', async () => {
    // The restore path. No debounce: the user is watching a progress dialog and
    // the next thing that happens is a reload.
    const browser = mirror({ accountsSortMode: 'name' });
    const store = transport({ version: 1, values: {} });
    const service = new PreferencesService({ mirror: browser, transport: store, debounceMs: 5_000 });
    await service.attach('user-1');

    await service.replaceAll({ version: 1, values: { accountsSortMode: 'balance-desc' } });

    expect(service.getItem('accountsSortMode')).toBe('balance-desc');
    expect(browser.values.accountsSortMode).toBe('balance-desc');
    expect(store.row?.values.accountsSortMode).toBe('balance-desc');
  });
});
