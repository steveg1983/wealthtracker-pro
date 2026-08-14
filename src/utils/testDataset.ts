/**
 * The dataset behind Settings → Data Management → "Load Test Data", and the
 * pure planning that has to happen before any of it can be written.
 *
 * It reuses the sample data that already exists for demo mode (utils/demoData)
 * rather than inventing a second set of pretend finances — the same accounts,
 * the same merchants, the same budgets and goals a visitor sees at ?demo=true.
 * What it does NOT reuse is demoData's ids.
 *
 * Ids: there are none here, deliberately. demoData's ids are fixed on purpose
 * (a demo session must keep its account identity across reloads), but a fixed
 * id is exactly the wrong thing to carry into a login: primary keys are global,
 * so loading the sample twice — or into a login that already has it — would
 * collide, and 'demo-account-checking' is not a uuid the cloud tables can even
 * store. This is the same problem a restore hits; see remapBackupIds in
 * services/backupService.ts. A restore has to preserve the shape of a file it
 * did not create, so it remaps. Here nothing needs preserving, so the simpler
 * answer applies: every row is created through the ordinary service layer and
 * takes whatever id the database (or the local store) mints for it. Rows refer
 * to each other through `accountKey` and category NAMES, which are resolved to
 * the freshly minted ids as the seed runs and are never written anywhere.
 *
 * Balances: an account is created with an OPENING balance, and every
 * transaction then moves it through the same atomic path every other write in
 * the app uses. So the opening balance is worked backwards from the total —
 * `expectedBalance − Σ(its transactions)` — and once the seed finishes the
 * stored balance equals the sample's headline figure with the transactions
 * actually accounting for it. Writing the headline figure as the opening
 * balance instead would double-count every transaction; writing zero would show
 * balances no part of the sample explains.
 */

import { toDecimal } from './decimal';
import {
  demoAccounts,
  demoBudgets,
  demoCategories,
  demoGoals,
  generateDemoTransactions
} from './demoData';
import { toDateValue } from './dateBoundary';
import type { Account, Budget, Category, Goal, Transaction } from '../types';

/** How many sample transactions a load creates. Quoted verbatim in the dialog. */
export const TEST_DATA_TRANSACTION_COUNT = 60;

// Lookup tables rather than casts: demoData is a plain object literal, so every
// one of these fields is typed `string` there, and a lookup both narrows the
// type and refuses anything the union does not cover.
const ACCOUNT_TYPES: Record<string, Account['type']> = {
  // The app calls a checking account 'current' everywhere the user can see it.
  checking: 'current',
  current: 'current',
  savings: 'savings',
  investment: 'investment',
  credit: 'credit'
};

const CATEGORY_TYPES: Record<string, Category['type']> = {
  income: 'income',
  expense: 'expense',
  both: 'both'
};

const CATEGORY_LEVELS: Record<string, Category['level']> = {
  type: 'type',
  sub: 'sub',
  detail: 'detail'
};

const BUDGET_PERIODS: Record<string, Budget['period']> = {
  weekly: 'weekly',
  monthly: 'monthly',
  quarterly: 'quarterly',
  yearly: 'yearly',
  custom: 'custom'
};

const GOAL_TYPES: Record<string, Goal['type']> = {
  savings: 'savings',
  'debt-payoff': 'debt-payoff',
  investment: 'investment',
  custom: 'custom'
};

const GOAL_PRIORITIES: Record<string, Goal['priority']> = {
  low: 'low',
  medium: 'medium',
  high: 'high'
};

/** An account to create. `key` is a local join key — it is never written. */
export interface TestDatasetAccount {
  key: string;
  name: string;
  type: Account['type'];
  currency: string;
  institution: string;
  accountNumber: string;
  /** The balance the account is CREATED with. */
  openingBalance: number;
  /** What it must hold once every transaction below has been written. */
  expectedBalance: number;
}

/**
 * A transaction to create. It names its account and category rather than
 * pointing at ids, because neither id exists until the seed runs.
 */
export interface TestDatasetTransaction {
  accountKey: string;
  date: Date;
  description: string;
  amount: number;
  categoryName: string;
  type: Transaction['type'];
  tags: string[];
  notes: string;
}

export interface TestDatasetBudget {
  name: string;
  categoryName: string;
  amount: number;
  period: Budget['period'];
}

export interface TestDatasetGoal {
  name: string;
  type: Goal['type'];
  targetAmount: number;
  currentAmount: number;
  targetDate: Date;
  category: string;
  priority: Goal['priority'];
}

/**
 * A category the rows above reference, by name.
 *
 * Level and parent travel with it because a category that has to be created has
 * to be created in the right place: the sample files transactions at detail
 * level, the way the transaction modal does, and a detail with no sub above it
 * is unreachable in every category picker in the app.
 */
export interface TestDatasetCategory {
  name: string;
  type: Category['type'];
  level: Category['level'];
  /** The name of the category above this one, when the sample defines one. */
  parentName?: string;
  color?: string;
  icon?: string;
}

export interface TestDataset {
  accounts: TestDatasetAccount[];
  transactions: TestDatasetTransaction[];
  budgets: TestDatasetBudget[];
  goals: TestDatasetGoal[];
  /**
   * Every category the rows above need, de-duplicated by name and ordered
   * PARENTS FIRST, so creating them in order can always resolve a parent id.
   */
  categories: TestDatasetCategory[];
}

const demoCategoryById = new Map(demoCategories.map(category => [category.id, category]));
const demoCategoryByName = new Map(
  demoCategories.map(category => [category.name.toLowerCase(), category])
);

type DemoCategory = (typeof demoCategories)[number];

const describeDemoCategory = (
  category: DemoCategory,
  parent: DemoCategory | undefined
): TestDatasetCategory => ({
  name: category.name,
  type: CATEGORY_TYPES[category.type] ?? 'expense',
  level: CATEGORY_LEVELS[category.level] ?? 'sub',
  parentName: parent?.name,
  color: 'color' in category ? category.color : undefined,
  icon: 'icon' in category ? category.icon : undefined
});

/**
 * A demo category and everything above it, outermost first.
 *
 * Iterative rather than recursive so a malformed parent link can only end the
 * walk, never spin: `seen` stops a cycle dead.
 */
function categoryChain(start: DemoCategory | undefined): TestDatasetCategory[] {
  const chain: TestDatasetCategory[] = [];
  const seen = new Set<string>();
  let current = start;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    const parentId = 'parentId' in current ? current.parentId : undefined;
    const parent = parentId ? demoCategoryById.get(parentId) : undefined;
    chain.unshift(describeDemoCategory(current, parent));
    current = parent;
  }
  return chain;
}

/**
 * Build the sample dataset.
 *
 * `transactionCount` is injectable so a test can work with a handful of rows;
 * the default is the figure the confirmation dialog quotes.
 */
export function buildTestDataset(
  transactionCount: number = TEST_DATA_TRANSACTION_COUNT
): TestDataset {
  const generated = generateDemoTransactions(transactionCount);
  const accountKeys = new Set(demoAccounts.map(account => account.id));

  // Ordered parents-first and de-duplicated by lower-cased name.
  const categories = new Map<string, TestDatasetCategory>();
  const requireCategory = (demo: DemoCategory | undefined): string | undefined => {
    const chain = categoryChain(demo);
    for (const entry of chain) {
      const key = entry.name.toLowerCase();
      if (!categories.has(key)) categories.set(key, entry);
    }
    return chain.length > 0 ? chain[chain.length - 1].name : undefined;
  };

  const transactions: TestDatasetTransaction[] = [];
  for (const row of generated) {
    // A row whose account or category is not in the sample could not be given
    // an id for it, and a transaction filed under nothing is precisely what
    // this module exists to avoid writing.
    if (!accountKeys.has(row.accountId)) continue;
    const categoryName = requireCategory(demoCategoryById.get(row.category));
    if (!categoryName) continue;

    transactions.push({
      accountKey: row.accountId,
      date: toDateValue(row.date),
      description: row.description,
      amount: row.amount,
      categoryName,
      // Read off the amount rather than carried over, so the sign and the type
      // can never disagree — the register colours money by one and totals by
      // the other.
      type: row.amount < 0 ? 'expense' : 'income',
      tags: row.tags,
      notes: row.notes
    });
  }

  const accounts: TestDatasetAccount[] = demoAccounts.map(account => {
    // Decimal, not `+=`: these are money totals, and the opening balance is the
    // figure that has to make the closing balance land exactly.
    const movement = transactions
      .filter(row => row.accountKey === account.id)
      .reduce((sum, row) => sum.plus(toDecimal(row.amount)), toDecimal(0));

    return {
      key: account.id,
      name: account.name,
      type: ACCOUNT_TYPES[account.type] ?? 'other',
      currency: account.currency,
      institution: account.institution,
      accountNumber: account.accountNumber,
      openingBalance: toDecimal(account.balance).minus(movement).toDecimalPlaces(2).toNumber(),
      expectedBalance: toDecimal(account.balance).toDecimalPlaces(2).toNumber()
    };
  });

  const budgets: TestDatasetBudget[] = [];
  for (const budget of demoBudgets) {
    const categoryName = requireCategory(demoCategoryByName.get(budget.category.toLowerCase()));
    if (!categoryName) continue;
    budgets.push({
      name: budget.name,
      categoryName,
      amount: budget.amount,
      period: BUDGET_PERIODS[budget.period] ?? 'monthly'
    });
  }

  const goals: TestDatasetGoal[] = demoGoals.map(goal => ({
    name: goal.name,
    type: GOAL_TYPES[goal.type] ?? 'savings',
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    targetDate: toDateValue(goal.deadline),
    // Free text on a goal, not a reference — see the note on goals.category in
    // services/backupService.ts.
    category: goal.category,
    priority: GOAL_PRIORITIES[goal.priority] ?? 'medium'
  }));

  return { accounts, transactions, budgets, goals, categories: [...categories.values()] };
}

// ── Categories in the target login ───────────────────────────────────────────

/**
 * A category the seed has to create because the login does not have it.
 *
 * `key` is the lower-cased name the rest of the plan refers to it by.
 * `parentKey` is set when the parent is ALSO being created in this same plan —
 * its id does not exist until it has been written, so the caller fills it in as
 * it goes. When the parent already exists, `category.parentId` carries its real
 * id and `parentKey` is absent.
 */
export interface PlannedCategory {
  key: string;
  category: Omit<Category, 'id'>;
  parentKey?: string;
}

export interface TestDataCategoryPlan {
  /** Lower-cased name → the id of a category the login already has. */
  resolved: Map<string, string>;
  /** In creation order: parents before the children that hang off them. */
  toCreate: PlannedCategory[];
}

/**
 * Work out which of the dataset's categories the login already has, and what
 * has to be created for the rest.
 *
 * Matching is by NAME, case-insensitively, because category ids differ between
 * every login — the cloud mints per-user uuids on first load (see
 * PlanningService.ensureCategories), so an id taken from the sample would mean
 * nothing in the target and a transaction carrying it would be uncategorised
 * everywhere in the app.
 *
 * The awkward case this exists for is a login with NO categories at all: a
 * freshly cleared account before the boot has re-seeded the defaults. Then even
 * the "Income"/"Expense" anchors are missing, and they are planned too — which
 * works because `needed` arrives parents-first and a child can point at the
 * parent planned just before it via `parentKey`.
 */
export function planTestDataCategories(
  needed: readonly TestDatasetCategory[],
  existing: readonly Category[]
): TestDataCategoryPlan {
  // Same name at two levels: prefer the one at the level the sample asked for,
  // so a transaction the sample files at detail level is not filed against the
  // bare type anchor that happens to share its name.
  const byNameAndLevel = new Map<string, Category>();
  const byName = new Map<string, Category>();
  for (const category of existing) {
    const name = category.name.toLowerCase();
    const keyed = `${name}|${category.level}`;
    if (!byNameAndLevel.has(keyed)) byNameAndLevel.set(keyed, category);
    if (!byName.has(name)) byName.set(name, category);
  }

  const resolved = new Map<string, string>();
  const planned = new Set<string>();
  const toCreate: PlannedCategory[] = [];

  for (const wanted of needed) {
    const key = wanted.name.toLowerCase();
    if (resolved.has(key) || planned.has(key)) continue;

    const match = byNameAndLevel.get(`${key}|${wanted.level}`) ?? byName.get(key);
    if (match) {
      resolved.set(key, match.id);
      continue;
    }

    const parentKey = wanted.parentName?.toLowerCase();
    toCreate.push({
      key,
      category: {
        name: wanted.name,
        type: wanted.type,
        level: wanted.level,
        // Resolved parent → its real id now. Planned parent → left for the
        // caller to fill from `parentKey` once it has written it.
        parentId: parentKey ? resolved.get(parentKey) : undefined,
        color: wanted.color,
        icon: wanted.icon
      },
      parentKey: parentKey && planned.has(parentKey) ? parentKey : undefined
    });
    planned.add(key);
  }

  return { resolved, toCreate };
}

// ── What a load does, and how it reports itself ──────────────────────────────

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

/**
 * What a load creates, for the confirmation dialog to quote before the user
 * commits to it. Categories are absent on purpose: how many of those get
 * created depends on what the login already has, and only the result knows.
 */
export const TEST_DATA_COUNTS = {
  accounts: demoAccounts.length,
  transactions: TEST_DATA_TRANSACTION_COUNT,
  budgets: demoBudgets.length
} as const;
