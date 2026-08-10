import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { usePayeeMemory } from './usePayeeMemory';
import { __setAppContextValue, __resetAppContextValue } from '../test/mocks/AppContextSupabase';
import type { Category, Transaction } from '../types';

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    dismissToast: vi.fn(),
  }),
}));

/**
 * A TRANSFER CATEGORY NEVER SPREADS.
 *
 * Payee memory's premise is that a payee's category is a habit worth repeating.
 * A transfer is not a habit: it is a movement between two named accounts, and
 * repeating one would mean creating a counterpart row over there for every
 * match — inventing money movements nobody recorded. Left ungated, one row
 * saved under "To/From Savings" would file every other unfiled row with the
 * same payee the same way, and each of them would be a transfer with no other
 * side: out of every report, out of the review band, still moving the balance.
 *
 * Every payee and figure below is invented: this repo is public.
 */

const CATEGORIES: Category[] = [
  { id: 'det-utilities', name: 'Utilities', type: 'expense', level: 'detail', parentId: 'grp-bills' },
  { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type' },
  {
    id: 'tofrom-thrift', name: 'To/From Synthetic Thrift', type: 'both', level: 'detail',
    parentId: 'type-transfer', isTransferCategory: true, accountId: 'acc-thrift',
  },
  { id: 'transfer-out', name: 'Transfer Out', type: 'both', level: 'detail', parentId: 'type-transfer' },
];

/** Two unfiled rows with the same payee — what a fan-out would reach. */
const TRANSACTIONS: Transaction[] = [
  {
    id: 'txn-a', date: new Date(Date.UTC(2026, 4, 2)), description: 'Ashvale Utilities',
    amount: -61, type: 'expense', category: '', accountId: 'acc-daily', cleared: false,
  },
  {
    id: 'txn-b', date: new Date(Date.UTC(2026, 5, 2)), description: 'Ashvale Utilities',
    amount: -61, type: 'expense', category: '', accountId: 'acc-daily', cleared: false,
  },
];

const applyCategoryToUncategorized = vi.fn(async () => 1);

type Propagate = ReturnType<typeof usePayeeMemory>['propagateCategory'];
let propagate: Propagate;

function Harness(): React.JSX.Element {
  propagate = usePayeeMemory().propagateCategory;
  return <div />;
}

beforeEach(() => {
  applyCategoryToUncategorized.mockClear();
  __setAppContextValue({
    transactions: TRANSACTIONS,
    categories: CATEGORIES,
    applyCategoryToUncategorized,
  });
  render(<Harness />);
});

afterEach(() => {
  cleanup();
  __resetAppContextValue();
});

const spread = (categoryId: string): Promise<void> => propagate({
  accountId: 'acc-daily',
  description: 'Ashvale Utilities',
  type: 'expense',
  categoryId,
  excludeId: 'txn-a',
});

describe('payee memory', () => {
  it('spreads an ordinary category to the same payee’s unfiled rows', async () => {
    await spread('det-utilities');
    expect(applyCategoryToUncategorized).toHaveBeenCalledWith(['txn-b'], 'det-utilities');
  });

  it('never spreads an account’s To/From category', async () => {
    await spread('tofrom-thrift');
    expect(applyCategoryToUncategorized).not.toHaveBeenCalled();
  });

  it('never spreads a legacy transfer sentinel either', async () => {
    // It names no account at all, so a counterpart could not be created even in
    // principle — and every report would still drop the rows it was stamped on.
    await spread('transfer-out');
    expect(applyCategoryToUncategorized).not.toHaveBeenCalled();
  });

  it('says nothing when it declines — the user asked to save ONE row', async () => {
    // Silence is the point: a fan-out is a courtesy nobody requested, so an
    // error about it would be the app complaining about its own idea. The
    // deliberate bulk screens are the ones that get told.
    await expect(spread('tofrom-thrift')).resolves.toBeUndefined();
  });
});
