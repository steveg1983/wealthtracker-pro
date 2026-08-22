import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * THE STANDING CURRENCY-AGGREGATION CENSUS (owner, 22 Aug: "is it possible
 * to do some sort of audit across the app to look for the lack of currency
 * conversions … It is important for a financial app that this is the case").
 *
 * The 22 Aug audit found the app's cross-account money sums were largely
 * currency-blind — native units summed as display units, a dollar counted
 * as a pound. The findings live in the audit and its ruling; THIS file is
 * what stops the list growing silently: every call site of the aggregation
 * primitives that caused the findings must be CLASSIFIED here. A new caller
 * fails this test until someone says which honest state it is in — the
 * ruling's four-state table, where only "sum native, silently" is
 * unacceptable.
 *
 * WHAT THIS CANNOT SEE: a hand-rolled `reduce` over amounts uses no
 * primitive and passes this census unseen. The fence covers the primitives
 * that produced the audit's findings; the audit itself is the tool for the
 * rest, and this header is the honest statement of the gap.
 *
 * Statuses:
 * - 'converts'            — passes a conversion (the ≈ + provenance path)
 * - 'excludes-and-states' — leaves foreign accounts out AND says so in the UI
 * - 'native-known'        — sums native, recorded by the audit, awaiting its
 *                           phase in the ruling's order. New code may NOT
 *                           enter at this status: convert or exclude-and-say.
 */

const PRIMITIVES = [
  'computeIncomeExpense',
  'calculateTotalBalance',
  'calculateNetWorth',
  'buildNetWorthSnapshots',
  'buildPortfolioHistory',
] as const;

type Status = 'converts' | 'excludes-and-states' | 'native-known';

/** file (repo-relative, posix) → the statuses of the primitives it calls. */
const LEDGER: Record<string, Partial<Record<(typeof PRIMITIVES)[number], Status>>> = {
  // ── the defining modules — a definition is not a call site ──
  'src/utils/incomeExpense.ts': { computeIncomeExpense: 'native-known' },
  'src/utils/calculations-decimal.ts': {
    calculateTotalBalance: 'native-known',
    calculateNetWorth: 'native-known',
  },
  'src/utils/netWorthSeries.ts': { buildNetWorthSnapshots: 'converts' },
  'src/utils/portfolioSummary.ts': {
    buildNetWorthSnapshots: 'converts',
    buildPortfolioHistory: 'converts',
    // portfolio value/allocation/returns — audit P2, awaiting its phase.
    calculateTotalBalance: 'native-known',
  },

  // ── converted surfaces ──
  'src/pages/NetWorthReport.tsx': { buildNetWorthSnapshots: 'converts' },
  'src/components/dashboard/reportWidgets/DashboardReportWidgets.tsx': {
    buildNetWorthSnapshots: 'converts',
  },
  'src/pages/Investments.tsx': { buildPortfolioHistory: 'converts' },
  // Partitions by currency before it sums (currencySubtotalsForBand).
  'src/pages/Accounts.tsx': { calculateTotalBalance: 'converts' },

  // ── the audit's known native sums, phase-ordered in the ruling ──
  'src/hooks/useReportDataset.ts': { computeIncomeExpense: 'native-known' },
  'src/components/dashboard/ImprovedDashboard.tsx': { computeIncomeExpense: 'native-known' },
  'src/pages/Calendar.tsx': { computeIncomeExpense: 'native-known' },
  'src/pages/Categorisation.tsx': { computeIncomeExpense: 'native-known' },
  'src/pages/reports/PeriodComparisonReport.tsx': { computeIncomeExpense: 'native-known' },
  'src/utils/categoryHealth.ts': { computeIncomeExpense: 'native-known' },
};

const SRC = join(process.cwd(), 'src');

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'test') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

describe('currency-aggregation census — no new unclassified money sums', () => {
  const files: string[] = [];
  walk(SRC, files);

  const found = new Map<string, Set<string>>();
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const rel = relative(process.cwd(), file).split('\\').join('/');
    for (const primitive of PRIMITIVES) {
      // A call or a definition — either makes the file part of the census.
      if (new RegExp(`\\b${primitive}\\s*\\(`).test(source)) {
        const set = found.get(rel) ?? new Set<string>();
        set.add(primitive);
        found.set(rel, set);
      }
    }
  }

  it('every caller of an aggregation primitive is classified', () => {
    const unclassified: string[] = [];
    for (const [file, primitives] of found) {
      for (const primitive of primitives) {
        if (LEDGER[file]?.[primitive as (typeof PRIMITIVES)[number]] === undefined) {
          unclassified.push(`${file} → ${primitive}`);
        }
      }
    }
    expect(
      unclassified,
      'New cross-account money aggregation with no classification. Convert it ' +
      '(the ≈ + provenance path), exclude foreign accounts AND say so, or — ' +
      'for existing audited debt only — record it native-known. Then add it ' +
      'to the LEDGER in this file with the status it earned.'
    ).toEqual([]);
  });

  it('the ledger carries no stale entries', () => {
    const stale: string[] = [];
    for (const [file, statuses] of Object.entries(LEDGER)) {
      for (const primitive of Object.keys(statuses)) {
        if (!found.get(file)?.has(primitive)) {
          stale.push(`${file} → ${primitive}`);
        }
      }
    }
    expect(
      stale,
      'A ledger entry no longer matches the code — the call moved or was ' +
      'removed. Delete or update the entry so the census stays true.'
    ).toEqual([]);
  });

  it('is not vacuous: the fence actually sees the known call sites', () => {
    expect(found.get('src/hooks/useReportDataset.ts')?.has('computeIncomeExpense')).toBe(true);
    expect(found.get('src/pages/NetWorthReport.tsx')?.has('buildNetWorthSnapshots')).toBe(true);
  });
});
