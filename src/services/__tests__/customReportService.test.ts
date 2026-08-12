/**
 * Custom reports: the store they now live in, and the rescue of the ones that
 * were in a browser.
 *
 * ── WHAT THESE TESTS ARE ABOUT ──────────────────────────────────────────────
 *
 * The two tests this file used to hold asserted the bug. They checked that
 * saving a report called `localStorage.setItem('money_management_custom_reports',
 * …)` — which was true, and was exactly why a report did not sync, did not
 * survive clearing the browser, was not in a backup and did not live in the
 * ledger file on a desktop. Asserting it kept it.
 *
 * So they are replaced rather than added to, and what is asserted instead is the
 * behaviour that made the change safe: a report goes to the STORE, and every
 * report somebody already had comes with it, exactly once.
 *
 * ── WHY THE STORE IS A FAKE AND NOT A MOCK OF THE PORT ──────────────────────
 *
 * `CustomReportStore` is four operations `Pick`ed off `dataPort`, and the fake
 * below implements them against a `Map`. That is a real implementation of the
 * seam's contract rather than a `vi.fn()` returning `undefined`: it mints ids
 * the way an engine does (the caller may not choose one — divergence B-5), it
 * refuses an unknown id by name the way both engines do, and it answers the
 * whole stored report. A test whose store returned whatever it was handed would
 * pass just as happily against a service that never wrote anything.
 *
 * The engines themselves are covered where engines are covered:
 * `src/services/port/__tests__` for the contract both must satisfy, and
 * `crates/wealth-core/tests/custom_report_writes.rs` for the file's own verbs.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  CustomReportService,
  LEGACY_REPORTS_KEY,
  REPORTS_ADOPTED_KEY,
  type CustomReportStore
} from '../customReportService';
import type { CustomReport } from '../../types';

/** A storage that records what was asked of it, so "did it read the old key?" is answerable. */
const createStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    raw: data
  };
};

/**
 * The four seam operations, against a Map, minting ids as an engine does.
 *
 * `failNext` is how the halfway-failure test stops it mid-adoption without
 * reaching for a mock: a store that refuses is a thing both real engines do.
 */
const createStore = () => {
  const rows = new Map<string, CustomReport>();
  let next = 0;
  const store = {
    failNext: false,
    created: 0,
    async listCustomReports(): Promise<CustomReport[]> {
      return [...rows.values()];
    },
    async createCustomReport(draft: Omit<CustomReport, 'id'>): Promise<CustomReport> {
      if (store.failNext) throw new Error('the store refused');
      next += 1;
      // Deliberately NOT the id the caller had: B-5 says the store mints it, and
      // a fake that echoed the caller's id would hide every pin that needs
      // repointing.
      const created: CustomReport = { ...draft, id: `minted-${next}` };
      rows.set(created.id, created);
      store.created += 1;
      return created;
    },
    async updateCustomReport(id: string, updates: Partial<CustomReport>): Promise<CustomReport> {
      const existing = rows.get(id);
      if (existing === undefined) throw new Error('Custom report not found');
      const updated: CustomReport = { ...existing, ...updates, id };
      rows.set(id, updated);
      return updated;
    },
    async deleteCustomReport(id: string): Promise<void> {
      rows.delete(id);
    }
  };
  return store;
};

const createPins = (initial?: string) => {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set('dashboardPinnedReports', initial);
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    raw: values
  };
};

const silent = { error: vi.fn() };

const legacyReport = (id: string, name: string) => ({
  id,
  name,
  description: '',
  components: [],
  filters: { dateRange: 'month' },
  createdAt: '2026-03-04T10:00:00.000Z',
  updatedAt: '2026-03-04T10:00:00.000Z'
});

const service = (
  storage: ReturnType<typeof createStorage>,
  store: CustomReportStore,
  pins?: ReturnType<typeof createPins>
) => new CustomReportService({ storage, store, pins: pins ?? createPins(), logger: silent });

describe('CustomReportService — the store', () => {
  it('saves a report to the store and reads the same one back', async () => {
    // THE ROUND TRIP the whole slice exists for: build it, persist it, and find
    // it still there when the app asks again. It used to be a round trip through
    // one browser's localStorage, which is the same assertion and a completely
    // different promise.
    const storage = createStorage();
    const store = createStore();
    const reports = service(storage, store);

    const created = await reports.createCustomReport({
      name: 'Where it went',
      description: 'last quarter',
      components: [{ id: 'one', type: 'summary-stats', title: 'Key figures', config: {}, width: 'full' }],
      filters: { dateRange: 'quarter', accounts: ['account-1'] },
      createdAt: new Date('2026-04-01T09:00:00.000Z'),
      updatedAt: new Date('2026-04-01T09:00:00.000Z')
    });

    const listed = await reports.listCustomReports();
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(created.id);
    expect(listed[0].name).toBe('Where it went');
    // The definition survives whole. A store that kept the name and dropped the
    // components would leave a report that opens and draws nothing.
    expect(listed[0].components).toHaveLength(1);
    expect(listed[0].filters.accounts).toEqual(['account-1']);

    // And nothing was written to the browser. This is the assertion the old
    // version of this file had backwards.
    expect(storage.setItem).not.toHaveBeenCalledWith(LEGACY_REPORTS_KEY, expect.anything());
  });

  it('does not let the caller choose the id', async () => {
    // B-5. The builder used to mint `report-${Date.now()}`, which is not a uuid
    // and which the cloud's column cannot hold.
    const store = createStore();
    const created = await service(createStorage(), store).createCustomReport({
      name: 'Anything', description: '', components: [], filters: { dateRange: 'month' },
      createdAt: new Date(), updatedAt: new Date()
    });
    expect(created.id).toBe('minted-1');
  });
});

describe('CustomReportService — adopting what a browser still holds', () => {
  it('carries every legacy report into the store, once', async () => {
    const storage = createStorage();
    storage.raw.set(LEGACY_REPORTS_KEY, JSON.stringify([
      legacyReport('report-1', 'Weekly Overview'),
      legacyReport('report-2', 'Budget vs Actual')
    ]));
    const store = createStore();
    const reports = service(storage, store);

    const carried = await reports.adoptLegacyReports();

    expect(carried.map(r => r.name)).toEqual(['Weekly Overview', 'Budget vs Actual']);
    expect(await reports.listCustomReports()).toHaveLength(2);
    // The definition travels whole — the name, the components, the filters.
    //
    // The two TIMESTAMPS deliberately are not asserted, and the omission is the
    // finding rather than a gap: neither engine honours a stated `createdAt`
    // (`create_custom_report`'s draft has no clock in it, and the cloud's writer
    // has no line for the column), so an adopted report is dated the day it was
    // carried across. The fake store below echoes whatever draft it is handed,
    // so an assertion here would pass while describing the fake instead of the
    // engines. `services/local/mappers/writes.ts` records the trade.
    expect(carried[0].components).toEqual([]);
  });

  it('stops reading the old key once every report has landed', async () => {
    // THE PRECISE MOMENT, asserted: the end of the first pass in which
    // everything landed. A second run must not read the old key at all — not
    // read it and skip, READ IT NOT AT ALL — because that is what makes the
    // marker a migration rather than a de-duplicator.
    const storage = createStorage();
    storage.raw.set(LEGACY_REPORTS_KEY, JSON.stringify([legacyReport('report-1', 'Weekly Overview')]));
    const store = createStore();
    const reports = service(storage, store);

    await reports.adoptLegacyReports();
    expect(store.created).toBe(1);

    storage.getItem.mockClear();
    const again = await reports.adoptLegacyReports();

    expect(again).toEqual([]);
    expect(store.created).toBe(1);
    expect(storage.getItem).toHaveBeenCalledWith(REPORTS_ADOPTED_KEY);
    expect(storage.getItem).not.toHaveBeenCalledWith(LEGACY_REPORTS_KEY);
  });

  it('marks a device that never had a report, so it never reads the key again', async () => {
    const storage = createStorage();
    const reports = service(storage, createStore());

    await reports.adoptLegacyReports();
    storage.getItem.mockClear();
    await reports.adoptLegacyReports();

    expect(storage.getItem).not.toHaveBeenCalledWith(LEGACY_REPORTS_KEY);
  });

  it('loses nothing when the store refuses halfway, and resumes where it stopped', async () => {
    const storage = createStorage();
    storage.raw.set(LEGACY_REPORTS_KEY, JSON.stringify([
      legacyReport('report-1', 'First'),
      legacyReport('report-2', 'Second')
    ]));
    const store = createStore();
    const reports = service(storage, store);

    // The first lands, then the store refuses.
    const original = store.createCustomReport.bind(store);
    let calls = 0;
    store.createCustomReport = async (draft) => {
      calls += 1;
      if (calls === 2) throw new Error('the store refused');
      return original(draft);
    };

    const first = await reports.adoptLegacyReports();
    expect(first.map(r => r.name)).toEqual(['First']);

    // The refusal is not rethrown — the caller is the boot, and a ledger must
    // not be replaced by an error screen over a list of saved questions.
    store.createCustomReport = original;
    const second = await reports.adoptLegacyReports();

    // Exactly the outstanding one, and no second copy of the first.
    expect(second.map(r => r.name)).toEqual(['Second']);
    expect(await reports.listCustomReports()).toHaveLength(2);
  });

  it('does not resurrect a report the person deleted after it was adopted', async () => {
    // The case the `ids` map buys over a bare "done" flag: adopt one, delete it,
    // be interrupted before the rest finished, and boot again. The old key still
    // holds the deleted report, because nothing has ever written to it.
    const storage = createStorage();
    storage.raw.set(LEGACY_REPORTS_KEY, JSON.stringify([
      legacyReport('report-1', 'Deleted later'),
      legacyReport('report-2', 'Kept')
    ]));
    const store = createStore();
    const reports = service(storage, store);

    // An interrupted first pass: only report-1 landed.
    const original = store.createCustomReport.bind(store);
    let calls = 0;
    store.createCustomReport = async (draft) => {
      calls += 1;
      if (calls === 2) throw new Error('the store refused');
      return original(draft);
    };
    const carried = await reports.adoptLegacyReports();
    expect(carried).toHaveLength(1);

    // The person deletes it from the reports page.
    await reports.deleteCustomReport(carried[0].id);
    expect(await reports.listCustomReports()).toHaveLength(0);

    // Next boot finishes the job.
    store.createCustomReport = original;
    await reports.adoptLegacyReports();

    const finalList = await reports.listCustomReports();
    expect(finalList.map(r => r.name)).toEqual(['Kept']);
    expect(finalList.some(r => r.name === 'Deleted later')).toBe(false);
  });

  it('repoints the dashboard’s pins, so an adopted report does not vanish from it', async () => {
    // The ids change, and `dashboardPinnedReports` holds `custom:<old id>`. Left
    // alone the widget resolves to nothing and renders null — a card that
    // disappears with no message and no way to tell it from having unpinned it.
    const storage = createStorage();
    storage.raw.set(LEGACY_REPORTS_KEY, JSON.stringify([legacyReport('report-1', 'Pinned one')]));
    const pins = createPins(JSON.stringify(['net-worth', 'custom:report-1']));
    const reports = service(storage, createStore(), pins);

    await reports.adoptLegacyReports();

    expect(JSON.parse(pins.raw.get('dashboardPinnedReports') ?? '[]')).toEqual([
      'net-worth',
      'custom:minted-1'
    ]);
  });

  it('leaves a pin it did not carry exactly as it was', async () => {
    // Two devices, one login. Device B's map holds only device B's old ids, so
    // device A's already-repointed pins must come through untouched.
    const storage = createStorage();
    storage.raw.set(LEGACY_REPORTS_KEY, JSON.stringify([legacyReport('report-1', 'Mine')]));
    const pins = createPins(JSON.stringify(['custom:someone-elses-id', 'custom:report-1']));
    const reports = service(storage, createStore(), pins);

    await reports.adoptLegacyReports();

    expect(JSON.parse(pins.raw.get('dashboardPinnedReports') ?? '[]')).toEqual([
      'custom:someone-elses-id',
      'custom:minted-1'
    ]);
  });

  it('treats an unreadable old key as empty rather than refusing to start', async () => {
    const storage = createStorage();
    storage.raw.set(LEGACY_REPORTS_KEY, '{not json at all');
    const reports = service(storage, createStore());

    await expect(reports.adoptLegacyReports()).resolves.toEqual([]);
  });
});
