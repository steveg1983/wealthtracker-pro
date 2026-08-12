import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilteredEmptyState from './FilteredEmptyState';

/**
 * Filtered-empty is the state a finance app must never get wrong: it looks
 * exactly like data loss, and it is not (DESIGN_PASS §4). Two facts make it
 * survivable — HOW MANY are hidden and WHAT is hiding them — so both are
 * pinned here rather than left to the copy of whichever screen renders it.
 */
describe('FilteredEmptyState', () => {
  it('says how many rows still exist, grouped, so the count reads at a glance', () => {
    render(<FilteredEmptyState hiddenCount={1284} filters={['Category: Travel']} onClear={vi.fn()} />);

    expect(screen.getByText('1,284')).toBeInTheDocument();
    expect(screen.getByText(/in this account are hidden by/)).toBeInTheDocument();
  });

  it('names every filter responsible, not just the first', () => {
    render(
      <FilteredEmptyState
        hiddenCount={12}
        filters={['Category: Travel', 'This month', 'To Review only']}
        onClear={vi.fn()}
      />
    );

    expect(screen.getByText('Category: Travel')).toBeInTheDocument();
    expect(screen.getByText('This month')).toBeInTheDocument();
    expect(screen.getByText('To Review only')).toBeInTheDocument();
    // Read as a sentence: "A, B and C".
    expect(document.body.textContent).toContain('This month and To Review only');
  });

  it('agrees with itself about one hidden row', () => {
    render(<FilteredEmptyState hiddenCount={1} filters={['Search: Ferrier']} onClear={vi.fn()} />);

    expect(document.body.textContent).toContain('1 in this account is hidden by');
  });

  it('offers exactly one control, and it lets go of the filters', () => {
    const onClear = vi.fn();
    render(<FilteredEmptyState hiddenCount={9} filters={['This month']} onClear={onClear} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('wears no plus: the remedy takes something away rather than adding one', () => {
    render(<FilteredEmptyState hiddenCount={9} filters={['This month']} onClear={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Clear filters' }).querySelector('svg')).toBeNull();
  });

  it('still says something true when the filters cannot be named', () => {
    render(<FilteredEmptyState hiddenCount={4} filters={[]} onClear={vi.fn()} />);

    expect(document.body.textContent).toContain('4 in this account are hidden by the filters you have set');
  });

  it('takes the scope it is given, for a list that is not one account', () => {
    render(
      <FilteredEmptyState hiddenCount={7} filters={['This month']} onClear={vi.fn()} scope="across your accounts" />
    );

    expect(document.body.textContent).toContain('7 across your accounts are hidden by');
  });
});
