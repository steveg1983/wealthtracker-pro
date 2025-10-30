/**
 * TEMPLATE: Real Component Test
 * Use this scaffold to convert mock tests to REAL database tests.
 * 
 * Steps:
 * 1. Replace ComponentName with the target component.
 * 2. Update props, interactions, and assertions to match the real flow.
 * 3. Replace TODO sections so the test drives meaningful behaviour.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ComponentName from './ComponentName'; // REPLACE with actual component
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { RealTestDatabase, testDb, withRealDatabase } from '@wealthtracker/testing';

type UserRecord = Awaited<ReturnType<RealTestDatabase['createUser']>>;
type AccountRecord = Awaited<ReturnType<RealTestDatabase['createAccount']>>;
type CategoryRecord = Awaited<ReturnType<RealTestDatabase['createCategory']>>;
type TransactionRecord = Awaited<ReturnType<RealTestDatabase['createTransaction']>>;
type BudgetRecord = Awaited<ReturnType<RealTestDatabase['createBudget']>>;

const fetchLatestTransaction = async (
  accountId: string,
): Promise<TransactionRecord | null> => {
  const { data, error } = await testDb
    .from('transactions')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

describe('ComponentName (REAL database)', () => {
  let db: RealTestDatabase;
  let testUser: UserRecord;
  let testAccount: AccountRecord;
  let testCategory: CategoryRecord;

  beforeAll(async () => {
    db = new RealTestDatabase();

    testUser = await db.createUser({
      email: 'component-test@example.com',
      first_name: 'Component',
      last_name: 'Test User',
    });

    testAccount = await db.createAccount(testUser.id, {
      name: 'Template Test Account',
      type: 'checking',
    });

    testCategory = await db.createCategory(testUser.id, {
      name: 'Template Test Category',
      type: 'expense',
    });
  });

  afterAll(async () => {
    await db.cleanup();
  });

  afterEach(async () => {
    // Optional: clean up any ad-hoc rows created inside individual tests.
    // Example:
    // await testDb.from('transactions').delete().eq('metadata->>source', 'component-template');
  });

  describe('Write paths', () => {
    it('persists a new transaction in Supabase', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      renderWithProviders(
        <ComponentName
          isOpen
          onClose={onClose}
          accountId={testAccount.id}
        />,
      );

      // TODO: trigger the UI flow that creates a transaction.
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      const createdTransaction = await waitFor(async () => {
        const record = await fetchLatestTransaction(testAccount.id);
        if (!record) {
          throw new Error('Transaction not created yet');
        }

        return record;
      });

      expect(createdTransaction).toMatchObject({
        account_id: testAccount.id,
      });

      const exists = await db.verifyExists('transactions', createdTransaction.id);
      expect(exists).toBe(true);
    });
  });

  describe('Read paths', () => {
    it('renders existing budget data', async () => {
      const existingBudget: BudgetRecord = await db.createBudget(testUser.id, testCategory.id, {
        name: 'Template Budget',
        amount: 750,
      });

      renderWithProviders(
        <ComponentName
          isOpen
          userId={testUser.id}
          data={{ budgetId: existingBudget.id }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(existingBudget.name)).toBeInTheDocument();
      });

      expect(screen.getByText(/750/)).toBeInTheDocument();
    });
  });

  describe('Scenario utilities', () => {
    it('works with withRealDatabase helper', async () => {
      await withRealDatabase(async (scenarioDb) => {
        const scenario = await scenarioDb.setupCompleteTestScenario();

        renderWithProviders(
          <ComponentName
            isOpen
            userId={scenario.user.id}
            accounts={scenario.accounts}
          />,
        );

        await waitFor(() => {
          expect(screen.getByText(/Grocery Shopping/i)).toBeInTheDocument();
        });
      });
    });
  });
});
