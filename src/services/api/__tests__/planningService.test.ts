/**
 * PlanningService — the cloud half, and the refusal that is now its other half.
 *
 * This file used to be a local-mode suite: every case passed `userId = null`,
 * which took the encrypted-localStorage branch and proved that branch worked.
 * Those branches are gone (WRITE-PATHS slice 5e) and so are those cases. They
 * were never reachable from the app — the only production importer of this
 * class is `dataService.ts`, and every call site there is inside a branch
 * guarded by `userId && this.supabaseChecker()` — and what they covered is now
 * covered against the class that really owns browser storage, in
 * `src/services/__tests__/dataService.test.ts`.
 *
 * What replaces them is the contract that took their place: EVERY operation
 * requires a configured client AND a resolved owner, and refuses by name
 * otherwise. That refusal is the point rather than a technicality — the null
 * owner it now rejects used to write the browser's copy, hand back an ordinary
 * Budget, and lose it at the next boot when the cloud read beside it answered
 * from a store the row never reached.
 *
 * No mocked Supabase anywhere (the project rule; the wire itself is the smoke
 * suite's job). The cloud-unavailable case is driven by emptying the two
 * credentials and re-importing the real module — a deployment, not a double.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PlanningService, goalFromDb, goalToDb } from '../planningService';
import { storageAdapter, STORAGE_KEYS } from '../../storageAdapter';
import type { Budget, Goal, Category } from '../../../types';

const OWNER = 'db-user-1';

const baseBudget = (): Omit<Budget, 'id' | 'spent'> => ({
  categoryId: 'cat-groceries',
  amount: 400,
  period: 'monthly',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  name: 'Groceries'
});

const baseGoal = (): Omit<Goal, 'id' | 'progress'> => ({
  name: 'Emergency Fund',
  type: 'savings',
  targetAmount: 10000,
  currentAmount: 0,
  targetDate: new Date('2026-12-31T00:00:00.000Z'),
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z')
});

const baseCategory = (): Omit<Category, 'id'> => ({
  name: 'Pets',
  type: 'expense',
  level: 'detail',
  parentId: 'sub-other-expense'
});

interface Operation {
  readonly method: string;
  readonly run: (service: typeof PlanningService, userId: string | null) => Promise<unknown>;
}

/**
 * Every operation the class exposes that talks to the cloud, and the shape a
 * caller invokes it with.
 *
 * The two bulk operations are given NON-EMPTY input deliberately: both answer an
 * empty request before they ever ask about the connection (a plan that adds no
 * categories must not produce an error message about a write nobody made), which
 * the pair of cases further down pins.
 *
 * `getCategories` / `saveCategories` are absent because they are not cloud
 * operations at all — they are the cache the cloud branches keep, covered on
 * their own below.
 */
const OPERATIONS: readonly Operation[] = [
  { method: 'getBudgets', run: (service, userId) => service.getBudgets(userId) },
  { method: 'createBudget', run: (service, userId) => service.createBudget(userId, baseBudget()) },
  { method: 'updateBudget', run: (service, userId) => service.updateBudget(userId, 'budget-1', { amount: 550 }) },
  { method: 'deleteBudget', run: (service, userId) => service.deleteBudget(userId, 'budget-1') },
  { method: 'getGoals', run: (service, userId) => service.getGoals(userId) },
  { method: 'createGoal', run: (service, userId) => service.createGoal(userId, baseGoal()) },
  { method: 'updateGoal', run: (service, userId) => service.updateGoal(userId, 'goal-1', { progress: 2500 }) },
  { method: 'deleteGoal', run: (service, userId) => service.deleteGoal(userId, 'goal-1') },
  { method: 'ensureCategories', run: (service, userId) => service.ensureCategories(userId) },
  { method: 'createCategory', run: (service, userId) => service.createCategory(userId, baseCategory()) },
  { method: 'createCategories', run: (service, userId) => service.createCategories(userId, [baseCategory()]) },
  { method: 'updateCategory', run: (service, userId) => service.updateCategory(userId, 'cat-1', { name: 'Pet Care' }) },
  { method: 'deleteCategory', run: (service, userId) => service.deleteCategory(userId, 'cat-1') },
  { method: 'deleteUnusedCategories', run: (service, userId) => service.deleteUnusedCategories(userId, ['cat-1']) },
  { method: 'mergeCategories', run: (service, userId) => service.mergeCategories(userId, 'cat-1', 'cat-2') }
];

const refusal = (method: string): string =>
  `${method} requires the cloud connection (local mode goes through DataService)`;

/**
 * The service as an unconfigured deployment sees it.
 *
 * `cloudReady` is `supabase !== null`, and `supabase` is built ONCE at module
 * load from VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — which this environment
 * supplies, so the statically imported class above always has a client. Emptying
 * those two variables and re-importing gives the real module with no client at
 * all: not a mock and not a double, just the deployment where Supabase was never
 * configured.
 *
 * The owner passed below is a REAL resolved id, which is the whole point of
 * asking this way: what is missing is the connection, and the refusal must not
 * depend on the id being absent too.
 */
const withoutSupabaseCredentials = async (): Promise<typeof import('../planningService')> => {
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  vi.resetModules();
  return import('../planningService');
};

describe('PlanningService with no cloud connection', () => {
  let offline: typeof import('../planningService');

  beforeAll(async () => {
    offline = await withoutSupabaseCredentials();
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('really has no client — the precondition every case below rests on', async () => {
    // Without this the suite could pass for the wrong reason: if the re-import
    // had picked the credentials up anyway, `cloudReady` would be TRUE, and a
    // refusal with a resolved owner would mean something else entirely.
    const { supabase, isSupabaseConfigured } = await import('../supabaseClient');
    expect(supabase).toBeNull();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it.each(OPERATIONS)('$method refuses, and says which operation refused', async ({ method, run }) => {
    await expect(run(offline.PlanningService, OWNER)).rejects.toThrow(refusal(method));
  });
});

describe('PlanningService with no resolved owner', () => {
  // The three collections as they stand before the refusals, so "nothing was
  // written" can be checked rather than assumed.
  const storedBudgets = [{ id: 'budget-existing', categoryId: 'cat-1', amount: 120, period: 'monthly', spent: 0 }];
  const storedGoals = [{ id: 'goal-existing', name: 'Deposit', targetAmount: 5000, progress: 100 }];
  const storedCategories = [{ id: 'cat-existing', name: 'Groceries', type: 'expense', level: 'detail' }];

  beforeEach(async () => {
    await storageAdapter.set(STORAGE_KEYS.BUDGETS, storedBudgets);
    await storageAdapter.set(STORAGE_KEYS.GOALS, storedGoals);
    await storageAdapter.set(STORAGE_KEYS.CATEGORIES, storedCategories);
  });

  it.each(OPERATIONS)('$method refuses a null owner rather than writing the browser copy', async ({ method, run }) => {
    await expect(run(PlanningService, null)).rejects.toThrow(refusal(method));
  });

  it('leaves all three collections byte-identical after every refusal', async () => {
    // THE HAZARD THIS CLOSES. A signed-in session whose database id had not
    // resolved yet passed a null owner, and every operation here answered by
    // writing browser storage: the budget appeared on screen, was never sent
    // anywhere, and was gone at the next boot when the cloud read answered
    // instead. Silent, permanent, with nothing logged.
    for (const { method, run } of OPERATIONS) {
      await expect(run(PlanningService, null)).rejects.toThrow(refusal(method));
    }

    expect(JSON.stringify(await storageAdapter.get(STORAGE_KEYS.BUDGETS)))
      .toBe(JSON.stringify(storedBudgets));
    expect(JSON.stringify(await storageAdapter.get(STORAGE_KEYS.GOALS)))
      .toBe(JSON.stringify(storedGoals));
    expect(JSON.stringify(await storageAdapter.get(STORAGE_KEYS.CATEGORIES)))
      .toBe(JSON.stringify(storedCategories));
  });

  it('answers an empty bulk request without asking about the connection', async () => {
    // Both bulk operations check for an empty request BEFORE the guard, and the
    // order is the behaviour: an import that plans no new categories, or no
    // prunes, asks anyway — because the plan is computed before it is known to
    // be empty — and refusing to write nothing would be an error message about
    // a write nobody made.
    await expect(PlanningService.createCategories(null, [])).resolves.toEqual([]);
    await expect(PlanningService.deleteUnusedCategories(null, [])).resolves.toBe(0);
  });
});

describe('PlanningService category cache', () => {
  // NOT a local mode — the cloud branches' own copy, refreshed after every
  // category row that lands, and what a signed-in person's offline boot reads
  // its category names from. It survived slice 5e for exactly that reason, and
  // it takes no owner and no connection because it is not asking the cloud
  // anything.
  beforeEach(async () => {
    await storageAdapter.set(STORAGE_KEYS.CATEGORIES, []);
  });

  it('saves and reads categories', async () => {
    const categories: Category[] = [
      { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
      { id: 'sub-salary', name: 'Salary', type: 'income', level: 'sub', parentId: 'type-income' }
    ];

    await PlanningService.saveCategories(categories);
    const fetched = await PlanningService.getCategories();

    expect(fetched).toHaveLength(2);
    expect(fetched[0].id).toBe('type-income');
    expect(fetched[1].parentId).toBe('type-income');
  });

  it('returns an empty list when nothing is cached', async () => {
    const fetched = await PlanningService.getCategories();
    expect(fetched).toEqual([]);
  });
});

/**
 * The CLOUD path — the mapping every signed-in user's goals travel through.
 *
 * The suite that used to sit above this one passed userId=null, which took the
 * localStorage branch and never touched goalToDb/goalFromDb: that is how
 * `isActive` came to be dropped on the way to the database (the modal's "Active
 * goal" tick wrote nothing) and how editing a goal's type erased its linked
 * accounts. These drive the mapping functions directly — real code, no mocked
 * Supabase; the wire itself belongs to the Supabase smoke suite.
 */
describe('PlanningService goal mapping (cloud path)', () => {
  describe('active / paused / completed', () => {
    it('writes isActive as the status column', () => {
      expect(goalToDb({ isActive: true }).status).toBe('active');
      expect(goalToDb({ isActive: false }).status).toBe('paused');
    });

    it('lets an explicit status win over isActive', () => {
      // A completed goal saved from the modal is still "active" to the user.
      expect(goalToDb({ isActive: true, status: 'completed' }).status).toBe('completed');
    });

    it('stamps completed_at when a goal completes', () => {
      const row = goalToDb({ status: 'completed' });
      expect(typeof row.completed_at).toBe('string');
      expect(Number.isNaN(Date.parse(String(row.completed_at)))).toBe(false);
    });

    it('keeps the completion date the caller supplied', () => {
      const row = goalToDb({ status: 'completed', completedAt: '2026-07-04T09:00:00.000Z' });
      expect(row.completed_at).toBe('2026-07-04T09:00:00.000Z');
    });

    it('clears completed_at when a goal is reopened or paused', () => {
      expect(goalToDb({ status: 'active' }).completed_at).toBeNull();
      expect(goalToDb({ isActive: false }).completed_at).toBeNull();
    });

    it('reads status back as isActive / achieved / completedAt', () => {
      const paused = goalFromDb({ id: 'g1', name: 'Car', status: 'paused' });
      expect(paused.isActive).toBe(false);
      expect(paused.achieved).toBe(false);

      const done = goalFromDb({
        id: 'g2',
        name: 'Car',
        status: 'completed',
        completed_at: '2026-07-04T09:00:00.000Z'
      });
      expect(done.isActive).toBe(true);
      expect(done.achieved).toBe(true);
      expect(done.completedAt).toBe('2026-07-04T09:00:00.000Z');
    });

    it('round-trips a paused goal', () => {
      const row = goalToDb({ name: 'Car', isActive: false });
      const back = goalFromDb({ id: 'g1', ...row });
      expect(back.isActive).toBe(false);
      expect(back.status).toBe('paused');
    });
  });

  describe('linked accounts', () => {
    it('stores them in metadata and reads them back', () => {
      const row = goalToDb({ linkedAccountIds: ['acc-1', 'acc-2'] });
      const back = goalFromDb({ id: 'g1', name: 'Deposit', ...row });
      expect(back.linkedAccountIds).toEqual(['acc-1', 'acc-2']);
    });

    it('round-trips an empty list, so unlinking every account sticks', () => {
      const row = goalToDb({ linkedAccountIds: [] }, undefined, { linkedAccountIds: ['acc-1'] });
      const back = goalFromDb({ id: 'g1', name: 'Deposit', ...row });
      expect(back.linkedAccountIds).toEqual([]);
    });
  });

  describe('metadata is merged, never rebuilt', () => {
    it('keeps the linked accounts when only the type changes', () => {
      const stored = { type: 'savings', linkedAccountIds: ['acc-1'], contributionAmount: 50 };
      const row = goalToDb({ type: 'investment' }, undefined, stored);

      expect(row.metadata).toEqual({
        type: 'investment',
        linkedAccountIds: ['acc-1'],
        contributionAmount: 50
      });
    });

    it('keeps the type when only the linked accounts change', () => {
      const stored = { type: 'debt-payoff', linkedAccountIds: ['acc-1'] };
      const row = goalToDb({ linkedAccountIds: ['acc-2'] }, undefined, stored);

      expect(row.metadata).toEqual({ type: 'debt-payoff', linkedAccountIds: ['acc-2'] });
    });

    it('leaves metadata alone when the update touches none of it', () => {
      expect(goalToDb({ name: 'Renamed' }).metadata).toBeUndefined();
    });
  });

  describe('target date', () => {
    it('writes a date-only column value', () => {
      expect(goalToDb({ targetDate: new Date('2026-12-31T00:00:00.000Z') }).target_date)
        .toBe('2026-12-31');
    });

    it('reads the column back as a real Date', () => {
      const back = goalFromDb({ id: 'g1', name: 'Deposit', target_date: '2026-12-31' });
      expect(back.targetDate).toBeInstanceOf(Date);
      expect(back.targetDate.toISOString().slice(0, 10)).toBe('2026-12-31');
    });
  });

  describe('description', () => {
    it('sends the empty string when the user clears it', () => {
      // Not "skip the field": skipping leaves the old text in the database.
      expect(goalToDb({ description: '' })).toHaveProperty('description', '');
    });

    it('leaves the column alone when the description is not part of the update', () => {
      expect(goalToDb({ name: 'Renamed' })).not.toHaveProperty('description');
    });
  });

  describe('amounts', () => {
    it('files progress as the current amount', () => {
      expect(goalToDb({ progress: 2500, currentAmount: 10 }).current_amount).toBe(2500);
      expect(goalToDb({ currentAmount: 2500 }).current_amount).toBe(2500);
    });

    it('reads current_amount back as both currentAmount and progress', () => {
      const back = goalFromDb({ id: 'g1', name: 'Deposit', current_amount: 2500 });
      expect(back.currentAmount).toBe(2500);
      expect(back.progress).toBe(2500);
    });
  });
});
