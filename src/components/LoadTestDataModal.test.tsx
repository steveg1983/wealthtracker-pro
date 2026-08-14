/**
 * LoadTestDataModal — what the dialog actually TELLS the user.
 *
 * The bug this replaces was a dialog that promised "5 sample accounts,
 * Multiple transactions, Example budgets" in front of a function that did
 * nothing, so the tests worth having are the ones that would have caught that:
 * the numbers on screen come from the dataset, a finished run says what it
 * wrote, and a failed one says it failed instead of closing.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { __setAppContextValue, __resetAppContextValue } from '../test/mocks/AppContextSupabase';
import LoadTestDataModal from './LoadTestDataModal';
import { TEST_DATA_COUNTS, type TestDataProgress, type TestDataSeedResult } from '../utils/testDataset';

const noResult: TestDataSeedResult = {
  categoriesCreated: 0,
  accounts: 0,
  transactions: 0,
  budgets: 0
};

describe('LoadTestDataModal', () => {
  beforeEach(() => {
    __resetAppContextValue();
  });

  afterEach(() => {
    cleanup();
    __resetAppContextValue();
  });

  it('quotes the dataset it is about to create, not a number someone typed', () => {
    render(<LoadTestDataModal isOpen onClose={() => {}} />);

    expect(screen.getByText(new RegExp(`${TEST_DATA_COUNTS.accounts} accounts`))).toBeTruthy();
    expect(screen.getByText(new RegExp(`${TEST_DATA_COUNTS.transactions} transactions`))).toBeTruthy();
    expect(screen.getByText(new RegExp(`${TEST_DATA_COUNTS.budgets} monthly budgets`))).toBeTruthy();
  });

  it('says what it created, using the counts the seed reported', async () => {
    __setAppContextValue({
      loadTestData: async (): Promise<TestDataSeedResult> => ({
        categoriesCreated: 16,
        accounts: 4,
        transactions: 60,
        budgets: 4
      })
    });

    render(<LoadTestDataModal isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load test data' }));

    await waitFor(() => {
      expect(
        screen.getByText('Created 4 accounts, 60 transactions and 4 budgets.')
      ).toBeTruthy();
    });
    expect(screen.getByText(/16 categories added/)).toBeTruthy();
  });

  it('says so when the login already had every category', async () => {
    __setAppContextValue({
      loadTestData: async (): Promise<TestDataSeedResult> => ({ ...noResult, accounts: 4 })
    });

    render(<LoadTestDataModal isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load test data' }));

    await waitFor(() => {
      expect(screen.getByText(/already in your login/)).toBeTruthy();
    });
  });

  it('reports a failure instead of closing on one', async () => {
    __setAppContextValue({
      loadTestData: async (): Promise<TestDataSeedResult> => {
        throw new Error('duplicate key value violates unique constraint');
      }
    });
    const onClose = vi.fn();

    render(<LoadTestDataModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load test data' }));

    await waitFor(() => {
      expect(screen.getByText('The sample data was not fully created.')).toBeTruthy();
    });
    expect(screen.getByText(/duplicate key value violates unique constraint/)).toBeTruthy();
    // The rows written before the failure are still there, and the user is told.
    expect(screen.getByText(/still in your login/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('names the phase it stopped in', async () => {
    __setAppContextValue({
      loadTestData: async (onProgress?: (p: TestDataProgress) => void): Promise<TestDataSeedResult> => {
        onProgress?.({ phase: 'transactions', fraction: 0.4, message: 'Adding transactions… 12 of 60' });
        throw new Error('network error');
      }
    });

    render(<LoadTestDataModal isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load test data' }));

    await waitFor(() => {
      expect(screen.getByText(/adding transactions… 12 of 60/i)).toBeTruthy();
    });
  });

  it('refuses to close while a seed is running', async () => {
    let release: (() => void) | undefined;
    __setAppContextValue({
      loadTestData: async (): Promise<TestDataSeedResult> => {
        await new Promise<void>((resolve) => { release = resolve; });
        return noResult;
      }
    });
    const onClose = vi.fn();

    render(<LoadTestDataModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load test data' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Loading…' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).not.toHaveBeenCalled();

    release?.();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    });
  });
});
