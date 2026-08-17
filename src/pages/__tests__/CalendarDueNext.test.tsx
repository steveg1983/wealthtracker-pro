import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Calendar from '../Calendar';
import { recurringAnswerKey } from '../../utils/suggestionDismissals';
import { normalisePayeeKey } from '../../utils/recurringDetection';

/**
 * The positive half of the forward panel: a CONFIRMED pattern's expected
 * payments appear, worded as due — and the projection reaches the panel
 * end to end, not just the unit. Every payee and figure invented.
 */

/** Six monthly payments, most recent ten days ago — alive and detectable. */
const history = () => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => ({
    id: `due-${i}`,
    accountId: 'acc1',
    description: 'FLIXWATCH.COM',
    amount: -7.99,
    date: new Date(now.getFullYear(), now.getMonth() - i, now.getDate() - 10),
    type: 'expense' as const,
    category: 'cat-x',
  }));
};

vi.mock('../../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    transactions: history(),
    accounts: [
      { id: 'acc1', name: 'Synthetic Current', type: 'current', balance: 0, openingBalance: 0 },
    ],
    suggestionDismissals: [
      {
        id: 'dis-1',
        kind: 'recurring-confirmed',
        // Built by the same builder the page uses, so this test pins the
        // WIRING (verdict → panel), not a copied string.
        subjectKey: recurringAnswerKey('acc1', 'out', normalisePayeeKey('FLIXWATCH.COM')),
        subjectIds: [],
        dismissedAt: new Date(),
      },
    ],
  }),
}));

vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => `£${Number(amount).toFixed(2)}`,
  }),
}));

describe('Calendar — confirmed patterns feed the forward panel', () => {
  it('lists the confirmed pattern as due, with its account, inside 30 days', () => {
    render(
      <MemoryRouter>
        <Calendar />
      </MemoryRouter>
    );

    const panel = screen.getByText('Due in the next 30 days').closest('section');
    expect(panel).not.toBeNull();
    // Expected ~20 days out (last paid 10 days ago on a monthly rhythm).
    expect(within(panel as HTMLElement).getByText('FLIXWATCH.COM')).toBeInTheDocument();
    expect(within(panel as HTMLElement).getByText('£7.99')).toBeInTheDocument();
    expect(within(panel as HTMLElement).getByText('Synthetic Current')).toBeInTheDocument();
    expect(within(panel as HTMLElement).queryByText(/Nothing confirmed yet/)).not.toBeInTheDocument();
  });
});
