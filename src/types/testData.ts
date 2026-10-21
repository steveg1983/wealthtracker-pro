/**
 * What loading the test dataset reports — the two shapes `AppState` carries.
 *
 * Here rather than in `utils/testDataset.ts`, where they were born, because
 * the app-state type imported them from there and so pulled the whole demo
 * seeder — `window`, `import.meta.env`, the preferences store, the logger —
 * into every project that reads the type barrel. The API project reads the
 * barrel now (the Claude connector shares the app's ledger arithmetic), and
 * a Node build has none of those. Two interfaces moved; the seeder
 * re-exports them, so its callers see no change.
 */

export type TestDataPhase =
  | 'categories'
  | 'accounts'
  | 'transactions'
  | 'budgets'
  | 'goals'
  | 'refreshing';

export interface TestDataProgress {
  phase: TestDataPhase;
  /** 0–1, for a progress bar. */
  fraction: number;
  message: string;
}

/** What actually got written. Every figure is counted, never predicted. */
export interface TestDataSeedResult {
  categoriesCreated: number;
  accounts: number;
  transactions: number;
  budgets: number;
}
