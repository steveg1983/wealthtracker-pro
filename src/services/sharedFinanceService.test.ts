/**
 * Shared (household) finances — the money maths.
 *
 * A household goal is filled a contribution at a time and split between
 * members, which is exactly the shape that floating point gets wrong: three
 * people saving towards £100 were each given 33.33333333333333, and a run of
 * `+=` contributions left a goal a fraction short of a target it had actually
 * met. Every figure here goes through Decimal and is stored to the penny.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { householdService } from './householdService';
import { sharedFinanceService } from './sharedFinanceService';
import type { Goal, Transaction } from '../types';

const goalInput = (name: string, targetAmount: number): Omit<Goal, 'id' | 'createdAt'> => ({
  name,
  type: 'savings',
  targetAmount,
  currentAmount: 0,
  targetDate: new Date('2026-12-31T00:00:00.000Z'),
  isActive: true,
  progress: 0,
  updatedAt: new Date('2026-08-01T00:00:00.000Z')
});

const expense = (id: string, amount: number, addedBy: string): Transaction => ({
  id,
  date: new Date(),
  amount: -amount,
  description: 'Groceries',
  category: 'cat-groceries',
  accountId: 'acc-1',
  type: 'expense',
  addedBy
});

describe('sharedFinanceService', () => {
  let householdId: string;
  let members: Array<{ id: string; name: string }>;

  beforeEach(() => {
    localStorage.clear();
    const household = householdService.createHousehold('Green Household', 'alex@example.test', 'Alex');
    householdId = household.id;

    const inviteBea = householdService.inviteMember('bea@example.test', 'member', household.members[0].id, 'Alex');
    householdService.acceptInvite(inviteBea.token, 'Bea');
    const inviteCass = householdService.inviteMember('cass@example.test', 'member', household.members[0].id, 'Alex');
    householdService.acceptInvite(inviteCass.token, 'Cass');

    members = householdService.getHousehold()!.members.map(m => ({ id: m.id, name: m.name }));
  });

  describe('createSharedGoal', () => {
    it('splits the target to the penny, not to sixteen decimal places', () => {
      const goal = sharedFinanceService.createSharedGoal(
        goalInput('Kitchen', 100),
        householdId,
        members[0].id,
        members[0].name
      );

      expect(goal.contributors).toHaveLength(3);
      for (const contributor of goal.contributors) {
        expect(contributor.targetAmount).toBe(33.33);
      }
    });

    it('gives every member an equal share', () => {
      const goal = sharedFinanceService.createSharedGoal(
        goalInput('Holiday', 1200),
        householdId,
        members[0].id,
        members[0].name
      );

      expect(goal.contributors.map(c => c.targetAmount)).toEqual([400, 400, 400]);
    });
  });

  describe('updateGoalProgress', () => {
    it('accumulates contributions exactly', () => {
      const goal = sharedFinanceService.createSharedGoal(
        goalInput('Rainy day', 1000),
        householdId,
        members[0].id,
        members[0].name
      );

      // The classic float trap: 0.1 + 0.2 = 0.30000000000000004.
      sharedFinanceService.updateGoalProgress(goal.id, members[0].id, members[0].name, 0.1);
      const updated = sharedFinanceService.updateGoalProgress(goal.id, members[0].id, members[0].name, 0.2);

      expect(updated.contributors[0].currentAmount).toBe(0.3);
      expect(updated.currentAmount).toBe(0.3);
    });

    it('totals every contributor', () => {
      const goal = sharedFinanceService.createSharedGoal(
        goalInput('New car', 900),
        householdId,
        members[0].id,
        members[0].name
      );

      sharedFinanceService.updateGoalProgress(goal.id, members[0].id, members[0].name, 100.05);
      sharedFinanceService.updateGoalProgress(goal.id, members[1].id, members[1].name, 200.1);
      const updated = sharedFinanceService.updateGoalProgress(goal.id, members[2].id, members[2].name, 99.85);

      expect(updated.currentAmount).toBe(400);
      expect(updated.progress).toBeCloseTo(44.444, 3);
    });

    it('marks the goal achieved when the pennies add up to the target', () => {
      const goal = sharedFinanceService.createSharedGoal(
        goalInput('Deposit', 0.3),
        householdId,
        members[0].id,
        members[0].name
      );

      sharedFinanceService.updateGoalProgress(goal.id, members[0].id, members[0].name, 0.1);
      const updated = sharedFinanceService.updateGoalProgress(goal.id, members[0].id, members[0].name, 0.2);

      // Float arithmetic would leave 0.30000000000000004 ≥ 0.3 by luck here,
      // but the stored figure would not be a real amount of money.
      expect(updated.completedAt).toBeTruthy();
      expect(updated.currentAmount).toBe(0.3);
    });

    it('refuses a contribution from someone who is not a contributor', () => {
      const goal = sharedFinanceService.createSharedGoal(
        goalInput('Loft', 500),
        householdId,
        members[0].id,
        members[0].name,
        true,
        [{
          memberId: members[0].id,
          memberName: members[0].name,
          targetAmount: 500,
          currentAmount: 0,
          percentage: 100
        }]
      );

      expect(() =>
        sharedFinanceService.updateGoalProgress(goal.id, members[1].id, members[1].name, 10)
      ).toThrow('Member is not a contributor to this goal');
    });
  });

  describe('calculateBudgetSpending', () => {
    it('adds a member\'s expenses to the penny', () => {
      const budget = sharedFinanceService.createSharedBudget(
        {
          name: 'Groceries',
          categoryId: 'cat-groceries',
          amount: 400,
          period: 'monthly',
          isActive: true,
          spent: 0,
          updatedAt: new Date()
        },
        householdId,
        members[0].id,
        members[0].name
      );

      const spending = sharedFinanceService.calculateBudgetSpending(
        budget.id,
        [
          expense('t1', 0.1, members[0].id),
          expense('t2', 0.2, members[0].id),
          expense('t3', 10.05, members[1].id)
        ],
        new Date()
      );

      expect(spending.get(members[0].id)).toBe(0.3);
      expect(spending.get(members[1].id)).toBe(10.05);
    });
  });
});
