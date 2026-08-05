/**
 * PlanningService — local (offline) mode tests.
 *
 * userId=null forces the encrypted-localStorage path, so these run against
 * real storage in jsdom with no Supabase involvement (per the project rule:
 * no mocked Supabase — the cloud path is covered by the supabase smoke suite).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PlanningService, goalFromDb, goalToDb } from '../planningService';
import { storageAdapter, STORAGE_KEYS } from '../../storageAdapter';
import type { Budget, Goal, Category } from '../../../types';

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

describe('PlanningService (local mode, userId=null)', () => {
  beforeEach(async () => {
    await storageAdapter.set(STORAGE_KEYS.BUDGETS, []);
    await storageAdapter.set(STORAGE_KEYS.GOALS, []);
    await storageAdapter.set(STORAGE_KEYS.CATEGORIES, []);
  });

  describe('budgets', () => {
    it('creates a budget and persists it', async () => {
      const created = await PlanningService.createBudget(null, baseBudget());

      expect(created.id).toBeTruthy();
      expect(created.spent).toBe(0);
      expect(created.amount).toBe(400);

      const fetched = await PlanningService.getBudgets(null);
      expect(fetched).toHaveLength(1);
      expect(fetched[0].id).toBe(created.id);
    });

    it('persists across a fresh read (survives refresh)', async () => {
      const created = await PlanningService.createBudget(null, baseBudget());
      // A second read simulates a new session reading cold storage.
      const reloaded = await PlanningService.getBudgets(null);
      expect(reloaded.map(b => b.id)).toContain(created.id);
    });

    it('updates a budget', async () => {
      const created = await PlanningService.createBudget(null, baseBudget());
      const updated = await PlanningService.updateBudget(null, created.id, { amount: 550 });

      expect(updated.amount).toBe(550);
      const fetched = await PlanningService.getBudgets(null);
      expect(fetched[0].amount).toBe(550);
    });

    it('throws when updating a missing budget', async () => {
      await expect(
        PlanningService.updateBudget(null, 'nope', { amount: 1 })
      ).rejects.toThrow('Budget not found');
    });

    it('deletes a budget', async () => {
      const created = await PlanningService.createBudget(null, baseBudget());
      await PlanningService.deleteBudget(null, created.id);

      const fetched = await PlanningService.getBudgets(null);
      expect(fetched).toHaveLength(0);
    });
  });

  describe('goals', () => {
    it('creates a goal with zero progress and persists it', async () => {
      const created = await PlanningService.createGoal(null, baseGoal());

      expect(created.id).toBeTruthy();
      expect(created.progress).toBe(0);

      const fetched = await PlanningService.getGoals(null);
      expect(fetched).toHaveLength(1);
      expect(fetched[0].name).toBe('Emergency Fund');
    });

    it('keeps money already put by when the goal is created', async () => {
      // `progress` IS the accumulated amount, so a goal started with £2,500
      // already saved must not be filed as £0.
      const created = await PlanningService.createGoal(null, {
        ...baseGoal(),
        currentAmount: 2500
      });

      expect(created.progress).toBe(2500);
      expect(created.currentAmount).toBe(2500);
    });

    it('updates goal progress', async () => {
      const created = await PlanningService.createGoal(null, baseGoal());
      const updated = await PlanningService.updateGoal(null, created.id, {
        progress: 2500,
        currentAmount: 2500
      });

      expect(updated.progress).toBe(2500);
      const fetched = await PlanningService.getGoals(null);
      expect(fetched[0].progress).toBe(2500);
    });

    it('throws when updating a missing goal', async () => {
      await expect(
        PlanningService.updateGoal(null, 'nope', { progress: 1 })
      ).rejects.toThrow('Goal not found');
    });

    it('deletes a goal', async () => {
      const created = await PlanningService.createGoal(null, baseGoal());
      await PlanningService.deleteGoal(null, created.id);

      const fetched = await PlanningService.getGoals(null);
      expect(fetched).toHaveLength(0);
    });
  });

  describe('categories', () => {
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

    it('returns empty array when nothing stored', async () => {
      const fetched = await PlanningService.getCategories();
      expect(fetched).toEqual([]);
    });

    it('ensureCategories falls back to defaults when local is empty (signed out)', async () => {
      const categories = await PlanningService.ensureCategories(null);
      // The default set includes the core type-level categories
      expect(categories.length).toBeGreaterThan(10);
      expect(categories.some(c => c.id === 'type-income')).toBe(true);
      expect(categories.some(c => c.id === 'type-expense')).toBe(true);
    });

    it('ensureCategories returns the stored local set when present (signed out)', async () => {
      const stored: Category[] = [
        { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true }
      ];
      await PlanningService.saveCategories(stored);

      const categories = await PlanningService.ensureCategories(null);
      expect(categories).toHaveLength(1);
      expect(categories[0].id).toBe('type-income');
    });

    it('creates a category locally', async () => {
      const created = await PlanningService.createCategory(null, {
        name: 'Pets', type: 'expense', level: 'detail', parentId: 'sub-other-expense'
      });

      expect(created.id).toBeTruthy();
      const fetched = await PlanningService.getCategories();
      expect(fetched.map(c => c.name)).toContain('Pets');
    });

    it('updates a category locally', async () => {
      const created = await PlanningService.createCategory(null, {
        name: 'Pets', type: 'expense', level: 'detail'
      });
      const updated = await PlanningService.updateCategory(null, created.id, { name: 'Pet Care' });

      expect(updated.name).toBe('Pet Care');
      const fetched = await PlanningService.getCategories();
      expect(fetched[0].name).toBe('Pet Care');
    });

    it('throws when updating a missing category', async () => {
      await expect(
        PlanningService.updateCategory(null, 'nope', { name: 'x' })
      ).rejects.toThrow('Category not found');
    });

    it('deletes a category and its children locally (cascade)', async () => {
      const parent = await PlanningService.createCategory(null, {
        name: 'Parent', type: 'expense', level: 'sub'
      });
      await PlanningService.createCategory(null, {
        name: 'Child', type: 'expense', level: 'detail', parentId: parent.id
      });

      await PlanningService.deleteCategory(null, parent.id);

      const fetched = await PlanningService.getCategories();
      expect(fetched).toHaveLength(0);
    });
  });
});

/**
 * The CLOUD path — the mapping every signed-in user's goals travel through.
 *
 * The suite above passes userId=null, which takes the localStorage branch and
 * never touches goalToDb/goalFromDb: that is how `isActive` came to be dropped
 * on the way to the database (the modal's "Active goal" tick wrote nothing) and
 * how editing a goal's type erased its linked accounts. These drive the mapping
 * functions directly — real code, no mocked Supabase; the wire itself belongs
 * to the Supabase smoke suite.
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
