import React, { useEffect, useRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import { AppProvider } from '../AppContextSupabase';
import { useApp } from '../AppContextSupabase';

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: null, isLoaded: false }),
}));

const Observer = () => {
  const { importData, accounts, transactions, categories, goals } = useApp();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      importData({
        accounts: [
          {
            id: 'temp-account',
            name: 'Offline Account',
            type: 'current',
            balance: 0,
            currency: 'GBP',
            lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
          },
        ],
        transactions: [
          {
            id: 'txn-1',
            date: new Date('2024-01-02T00:00:00.000Z'),
            amount: 10,
            description: 'Test',
            category: 'misc',
            accountId: 'temp-account',
            type: 'expense',
            pending: false,
            isReconciled: false,
          },
        ],
        categories: [
          {
            id: 'cat-1',
            name: 'Transfers',
            type: 'both',
            level: 'detail',
            accountId: 'temp-account',
          },
        ],
        goals: [
          {
            id: 'goal-1',
            name: 'Rainy Day',
            type: 'savings',
            targetAmount: 1000,
            currentAmount: 100,
            targetDate: new Date('2025-01-01T00:00:00.000Z'),
            isActive: true,
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: new Date('2024-01-01T00:00:00.000Z'),
            progress: 10,
            accountId: 'temp-account',
            linkedAccountIds: ['temp-account'],
          },
        ],
      });
    }
  }, [importData]);

  return (
    <div
      data-testid="observer"
      data-accounts={accounts.map(account => account.id).join(',')}
      data-transactions={transactions.map(transaction => transaction.accountId).join(',')}
      data-categories={categories.map(category => category.accountId ?? '').join(',')}
      data-goals={goals.map(goal => goal.accountId ?? '').join(',')}
      data-goal-links={goals.map(goal => (goal.linkedAccountIds ?? []).join('|')).join(',')}
    />
  );
};

describe('AppProvider offline ID reconciliation', () => {
  afterEach(() => {
    cleanup();
  });

  it('updates all dependent state when auto-sync ID reconciliation fires', async () => {
    const { getByTestId } = render(
      <AppProvider>
        <Observer />
      </AppProvider>,
    );

    const observer = getByTestId('observer');

    await waitFor(() => {
      expect(observer.dataset.accounts).toBe('temp-account');
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('auto-sync-id-reconciled', {
          detail: {
            entity: 'account',
            tempId: 'temp-account',
            permanentId: 'uuid-account-1',
            account: {
              id: 'uuid-account-1',
              name: 'Synced Account',
              type: 'current',
              balance: 0,
              currency: 'GBP',
              lastUpdated: new Date('2024-02-01T00:00:00.000Z'),
            },
          },
        }),
      );
    });

    await waitFor(() => {
      expect(observer.dataset.accounts).toBe('uuid-account-1');
      expect(observer.dataset.transactions).toBe('uuid-account-1');
      expect(observer.dataset.categories).toBe('uuid-account-1');
      expect(observer.dataset.goals).toBe('uuid-account-1');
      expect(observer.dataset.goalLinks).toBe('uuid-account-1');
    });
  });
});
