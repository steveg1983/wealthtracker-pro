/**
 * The transactions table's category cell, when the app was the one who filled
 * it in.
 *
 * This is the register's sibling surface: the same question ("have I checked
 * this row?") asked of a list that spans every account. It marks a guess the
 * same way the register does, and answers it the way this table already
 * answers a category — by letting the user pick one, which the service records
 * as a category they vouch for.
 *
 * Every name and figure below is invented: this repo is public.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { TransactionRow } from './TransactionRow';
import { createMockTransaction, createMockAccount } from '../test/factories';
import { formatCurrency } from '../utils/currency';
import type { Transaction } from '../types';

const renderInTable = (ui: React.ReactElement) =>
  render(<table><tbody>{ui}</tbody></table>);

const props = {
  account: createMockAccount(),
  categoryPath: 'Food > Groceries',
  compactView: false,
  formatCurrency,
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  columnOrder: ['date', 'description', 'category', 'amount'],
  columnWidths: { date: 180, description: 300, category: 200, amount: 150 },
};

/** The cell the badge lives in, found through the category it is about. */
const categoryCell = (): HTMLElement => {
  const cell = screen.getByText('Food > Groceries').closest('td');
  if (!(cell instanceof HTMLElement)) throw new Error('no category cell rendered');
  return cell;
};

const guessed = (over: Partial<Transaction> = {}): Transaction =>
  createMockTransaction({
    description: 'Synthetic guessed row',
    category: 'det-groceries',
    categoryConfirmed: false,
    ...over,
  });

describe('TransactionRow — a category the app guessed', () => {
  it('marks the cell in words, not only in colour', () => {
    renderInTable(<TransactionRow {...props} transaction={guessed()} />);

    expect(within(categoryCell()).getByText('Suggested')).toBeInTheDocument();
    expect(within(categoryCell()).getByText(/category — not confirmed yet/)).toBeInTheDocument();
  });

  it('leaves the editing control\'s own name alone', () => {
    // The badge is a statement about the row, not part of the button's label:
    // "Change category, currently Groceries Suggested" would name a category
    // that does not exist.
    renderInTable(
      <TransactionRow {...props} transaction={guessed()} categories={[]} onUpdateCategory={vi.fn()} />
    );

    expect(
      screen.getByRole('button', { name: 'Change category, currently Food > Groceries' })
    ).toBeInTheDocument();
    expect(within(categoryCell()).getByText('Suggested')).toBeInTheDocument();
  });

  it('says nothing about a category the user stands behind', () => {
    renderInTable(
      <TransactionRow {...props} transaction={guessed({ categoryConfirmed: true })} />
    );

    expect(within(categoryCell()).queryByText('Suggested')).not.toBeInTheDocument();
  });

  it('treats a row with no provenance flag as the user\'s own', () => {
    const noFlag = guessed();
    delete noFlag.categoryConfirmed;

    renderInTable(<TransactionRow {...props} transaction={noFlag} />);

    expect(within(categoryCell()).queryByText('Suggested')).not.toBeInTheDocument();
  });

  /**
   * The row is memoised on a hand-written comparison of the fields it draws.
   * Confirming a suggestion changes NOTHING else — same category, same amount,
   * same description — so provenance has to be one of the compared fields or
   * the badge would sit there after the user had answered it.
   */
  it('redraws when the only thing that changed is who vouched for it', () => {
    const { rerender } = renderInTable(<TransactionRow {...props} transaction={guessed()} />);
    expect(within(categoryCell()).getByText('Suggested')).toBeInTheDocument();

    rerender(
      <table><tbody>
        <TransactionRow {...props} transaction={guessed({ categoryConfirmed: true })} />
      </tbody></table>
    );

    expect(within(categoryCell()).queryByText('Suggested')).not.toBeInTheDocument();
  });
});
