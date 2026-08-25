import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CategoryDataHealthPanel from './CategoryDataHealthPanel';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import type { CategoryHealth } from '../utils/categoryHealth';

/**
 * The data-health line for rows whose transfer category has no other side.
 *
 * Three things are asserted, and they are the three the panel's own rule
 * demands of every line it carries: the COUNT is the measured one, the sentence
 * names the CONSEQUENCE rather than the symptom, and the REMEDY hands back the
 * exact rows so the surface it opens shows those and no others.
 *
 * The consequence is worth stating plainly, because it is not obvious and it is
 * why the line exists. Every report in the app classifies by CATEGORY
 * (`classifyFlow`), so a row filed under "To/From <account>" is treated as a
 * transfer whatever its type field says — it is left out of income AND out of
 * spending. It is not in the uncategorised review band either, because it has a
 * real category id. And it has no counterpart, so nothing balances it. The
 * balance moved and no report ever heard about it.
 *
 * Every figure below is invented: this repo is public.
 */

const CLEAN: CategoryHealth = {
  uncategorizedCount: 0,
  uncategorizedIn: 0,
  uncategorizedOut: 0,
  unassignedBucketCount: 0,
  unassignedBucketCategoryId: null,
  danglingCount: 0,
  emptyCategoryCount: 0,
  emptyCategoryIds: [],
  transferFilingMismatchCount: 0,
  transferFilingMismatchIds: [],
  holdsForeign: false,
  hasWarnings: false,
};

const onFixTransferFilings = vi.fn();

const renderPanel = (health: CategoryHealth): void => {
  render(
    <MemoryRouter>
      <PreferencesProvider>
        <CategoryDataHealthPanel
          health={health}
          onFileUnassignedBucket={vi.fn()}
          onShowEmptyCategories={vi.fn()}
          onFixTransferFilings={onFixTransferFilings}
        />
      </PreferencesProvider>
    </MemoryRouter>
  );
};

beforeEach(() => {
  onFixTransferFilings.mockClear();
});

afterEach(cleanup);

describe('the “transfer category with no other side” line', () => {
  it('renders NOTHING at all when the count is zero', () => {
    renderPanel(CLEAN);
    // Not "0 transactions", not a green tick — the panel disappears entirely
    // when the data is clean, and this line disappears with it.
    expect(screen.queryByText('Data health')).not.toBeInTheDocument();
  });

  it('is absent while other lines show, if this measure is zero', () => {
    renderPanel({ ...CLEAN, emptyCategoryCount: 2, emptyCategoryIds: ['a', 'b'], hasWarnings: true });
    expect(screen.getByText('Data health')).toBeInTheDocument();
    expect(screen.queryByText(/transfer category with no other side/)).not.toBeInTheDocument();
  });

  it('names the count and the CONSEQUENCE, not the mismatch', () => {
    renderPanel({
      ...CLEAN,
      transferFilingMismatchCount: 3,
      transferFilingMismatchIds: ['t1', 't2', 't3'],
      hasWarnings: true,
    });

    expect(screen.getByText('3')).toBeInTheDocument();
    // What actually happens to these rows, in the user's terms.
    expect(screen.getByText(/move the account balance/)).toBeInTheDocument();
    expect(screen.getByText(/neither income nor spending in any report/)).toBeInTheDocument();
    expect(screen.getByText(/never appear in the review band/)).toBeInTheDocument();
  });

  it('reads as one row when there is one', () => {
    renderPanel({
      ...CLEAN,
      transferFilingMismatchCount: 1,
      transferFilingMismatchIds: ['t1'],
      hasWarnings: true,
    });
    expect(screen.getByText(/transaction carries a transfer category/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fix it one by one' })).toBeInTheDocument();
  });

  it('hands the remedy the exact rows that were measured', () => {
    renderPanel({
      ...CLEAN,
      transferFilingMismatchCount: 2,
      transferFilingMismatchIds: ['txn-alpha', 'txn-beta'],
      hasWarnings: true,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Fix them one by one' }));

    // The list the user lands on is exactly the rows the number counted — a
    // warning that pointed at a different set would be worse than none.
    expect(onFixTransferFilings).toHaveBeenCalledWith(['txn-alpha', 'txn-beta']);
  });
});
