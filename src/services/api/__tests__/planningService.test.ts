/**
 * PlanningService — local (offline) mode tests.
 *
 * userId=null forces the encrypted-localStorage path, so these run against
 * real storage in jsdom with no Supabase involvement (per the project rule:
 * no mocked Supabase — the cloud path is covered by the supabase smoke suite).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PlanningService } from '../planningService';
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
  });
});
