/**
 * Goals page.
 *
 * The page had NO render test, which is how it shipped an unbounded render
 * loop: an effect that stored `[...goals]` in state while listing that same
 * state as a dependency. Nothing failed — the page simply re-rendered until
 * the tab ran out of memory. Every test here therefore runs under a render
 * counter (see `RenderCounter`), the same circuit-breaker idea as
 * src/contexts/NotificationContext.test.tsx.
 *
 * The rest covers the promise the page makes on its own tip: link accounts and
 * their balance IS the goal's progress.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import Goals from '../Goals';
import { toDecimal } from '../../utils/decimal';
import type { Goal } from '../../types';
import type { DecimalAccount } from '../../types/decimal-types';

const decimalAccount = (
  id: string,
  name: string,
  balance: number,
  overrides: Partial<DecimalAccount> = {}
): DecimalAccount => ({
  id,
  name,
  type: 'savings',
  balance: toDecimal(balance),
  currency: 'GBP',
  lastUpdated: new Date('2026-08-01'),
  ...overrides
});

const goal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 'goal-1',
  name: 'House Deposit',
  type: 'savings',
  targetAmount: 10000,
  currentAmount: 2500,
  targetDate: new Date('2026-12-31T00:00:00.000Z'),
  isActive: true,
  status: 'active',
  progress: 2500,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides
});

const updateGoal = vi.fn(() => Promise.resolve());
const deleteGoal = vi.fn(() => Promise.resolve());

let renderCount = 0;

/**
 * A circuit breaker. A render loop does not fail a test — it renders until the
 * worker runs out of memory — so it has to be caught by counting.
 *
 * React's Profiler is what does the counting: a wrapper component would be
 * useless here, because a child re-rendering off its own state does not
 * re-render its parent. The Profiler fires on every COMMIT in its subtree,
 * which is precisely what a runaway effect produces.
 */
const countRender = (): void => {
  renderCount += 1;
  if (renderCount > 30) {
    throw new Error('Goals page is looping: its effects never settle');
  }
};

const renderGoals = (goals: Goal[], accounts: DecimalAccount[] = []) => {
  __setAppContextValue({
    goals,
    getDecimalAccounts: () => accounts,
    updateGoal,
    deleteGoal
  });

  return render(
    <MemoryRouter initialEntries={['/goals']}>
      <PreferencesProvider>
        <NotificationProvider>
          <React.Profiler id="goals" onRender={countRender}>
            <Goals />
          </React.Profiler>
        </NotificationProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

describe('Goals page', () => {
  beforeEach(() => {
    renderCount = 0;
    localStorage.clear();
    vi.clearAllMocks();
    // No network in a unit test: the currency helper falls back to its built-in
    // rates when the rates request fails, which is all these GBP goals need.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    __resetAppContextValue();
  });

  it('settles after a handful of renders (no runaway effect)', async () => {
    renderGoals([goal()]);

    expect(await screen.findByText('House Deposit')).toBeInTheDocument();
    // Give every effect — including the async linked-balance pass — a chance
    // to run and re-run before counting.
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Active Goals' })).toBeInTheDocument()
    );
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(renderCount).toBeLessThanOrEqual(6);
  });

  it('shows a manual goal at its stored amount', async () => {
    renderGoals([goal()]);

    expect(await screen.findByText('House Deposit')).toBeInTheDocument();
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });

  describe('linked accounts drive progress', () => {
    it('uses the linked balances, not the typed-in amount', async () => {
      renderGoals(
        [goal({ currentAmount: 2500, linkedAccountIds: ['acc-1', 'acc-2'] })],
        [decimalAccount('acc-1', 'Natwest Savings', 4000), decimalAccount('acc-2', 'Cash ISA', 3000)]
      );

      // £4,000 + £3,000 against a £10,000 target — the stored £2,500 (25%) is
      // no longer what the goal is worth.
      expect(await screen.findByText('70.0%')).toBeInTheDocument();
      expect(screen.queryByText('25.0%')).not.toBeInTheDocument();
    });

    it('offers each linked account as a way into it', async () => {
      renderGoals(
        [goal({ linkedAccountIds: ['acc-1'] })],
        [decimalAccount('acc-1', 'Natwest Savings', 4000)]
      );

      expect(await screen.findByRole('button', { name: 'Open Natwest Savings' })).toBeInTheDocument();
    });

    it('counts what is left and says how many links are missing', async () => {
      renderGoals(
        [goal({ linkedAccountIds: ['acc-1', 'acc-gone'] })],
        [decimalAccount('acc-1', 'Natwest Savings', 4000)]
      );

      expect(await screen.findByText(/1 linked account unavailable/)).toBeInTheDocument();
      expect(screen.getByText(/this total covers the rest/)).toBeInTheDocument();
      expect(screen.getByText('40.0%')).toBeInTheDocument();
    });

    it('falls back to the last saved amount when every link has gone', async () => {
      renderGoals([goal({ currentAmount: 2500, linkedAccountIds: ['acc-gone', 'acc-closed'] })], [
        decimalAccount('acc-closed', 'Old ISA', 900, { isActive: false })
      ]);

      // Never silently £0: the goal shows what it last knew, and says why.
      expect(await screen.findByText('25.0%')).toBeInTheDocument();
      expect(screen.getByText(/2 linked accounts unavailable/)).toBeInTheDocument();
      expect(screen.getByText(/showing the last saved amount/)).toBeInTheDocument();
    });

    it('treats a closed account as unavailable, not as a balance', async () => {
      renderGoals(
        [goal({ currentAmount: 0, linkedAccountIds: ['acc-1', 'acc-closed'] })],
        [
          decimalAccount('acc-1', 'Natwest Savings', 5000),
          decimalAccount('acc-closed', 'Old ISA', 5000, { isActive: false })
        ]
      );

      // 50%, not 100%: the closed account's money is not in play.
      expect(await screen.findByText('50.0%')).toBeInTheDocument();
      expect(screen.getByText(/1 linked account unavailable/)).toBeInTheDocument();
    });
  });

  describe('active, paused and completed', () => {
    it('never lists a goal as both active and completed', async () => {
      renderGoals([goal({ currentAmount: 10000, progress: 10000 })]);

      expect(await screen.findByRole('heading', { name: 'Completed Goals' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Active Goals' })).not.toBeInTheDocument();
    });

    it('files a paused goal under Paused, not Completed', async () => {
      renderGoals([goal({ isActive: false, status: 'paused' })]);

      expect(await screen.findByRole('heading', { name: 'Paused Goals' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Completed Goals' })).not.toBeInTheDocument();
      expect(screen.getByText('No active goals')).toBeInTheDocument();
    });

    it('records the achievement against the goal itself', async () => {
      renderGoals([goal({ currentAmount: 10000, progress: 10000, status: 'active' })]);

      await waitFor(() => expect(updateGoal).toHaveBeenCalledTimes(1));
      expect(updateGoal).toHaveBeenCalledWith('goal-1', expect.objectContaining({
        status: 'completed',
        achieved: true
      }));
    });

    it('does not rewrite a goal that is already recorded as completed', async () => {
      renderGoals([goal({ currentAmount: 10000, progress: 10000, status: 'completed' })]);

      expect(await screen.findByRole('heading', { name: 'Completed Goals' })).toBeInTheDocument();
      expect(updateGoal).not.toHaveBeenCalled();
    });
  });

  describe('deadlines and pacing', () => {
    it('says "Due today" on the day itself', async () => {
      const today = new Date();
      renderGoals([goal({ targetDate: today })]);

      expect(await screen.findByText('Due today')).toBeInTheDocument();
    });

    it('singularises the last day', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      renderGoals([goal({ targetDate: tomorrow })]);

      expect(await screen.findByText('1 day left')).toBeInTheDocument();
    });

    it('shows what it takes each month to stay on track', async () => {
      const target = new Date();
      target.setDate(target.getDate() + 148);
      renderGoals([goal({ currentAmount: 2500, targetDate: target })]);

      expect(await screen.findByText(/\/month to stay on track/)).toBeInTheDocument();
    });

    it('says nothing about pacing once the goal is met', async () => {
      renderGoals([goal({ currentAmount: 12000, progress: 12000, status: 'active' })]);

      await screen.findByRole('heading', { name: 'Completed Goals' });
      expect(screen.queryByText(/\/month to stay on track/)).not.toBeInTheDocument();
    });
  });

  it('shows the empty state when there are no goals at all', async () => {
    renderGoals([]);

    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No goals yet')).toBeInTheDocument();
  });
});
