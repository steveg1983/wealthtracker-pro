import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AccountBreakdownModal, { type AccountBreakdownRow } from './AccountBreakdownModal';

/**
 * The drill behind the net-worth cards must AGREE with the card it opened
 * from (currency audit, 22 Aug): the card converts a foreign account into the
 * display currency, and this modal used to sum the same account's native
 * units — a $200 row counted as £200 in the total under a card that said
 * £100. A foreign row now carries `converted` and every total sums that,
 * wearing ≈; the per-row figure stays the account's own currency.
 *
 * Every figure here is invented; the repo is public.
 */
describe('AccountBreakdownModal — totals agree with the converted card', () => {
  const rows: AccountBreakdownRow[] = [
    {
      id: 'gbp-1',
      name: 'Everyday',
      accountType: 'current',
      balance: 1000,
      formatted: '£1,000.00',
    },
    {
      id: 'usd-1',
      name: 'Dollar Savings',
      accountType: 'savings',
      balance: 200,
      converted: 100, // $200 at two-to-one — the page computed this
      formatted: '$200.00',
    },
  ];

  const renderModal = (view: 'net' | 'assets' | 'liabilities' = 'net') =>
    render(
      <AccountBreakdownModal
        view={view}
        onClose={vi.fn()}
        rows={rows}
        formatTotal={(v) => `£${v.toFixed(2)}`}
        onOpenAccount={vi.fn()}
      />
    );

  it('sums the converted value, marks the total ≈, and keeps the row native', () => {
    renderModal();
    // 1000 + 100, never 1000 + 200 — in the Assets band AND the net total,
    // each wearing the ≈ that says a conversion is inside the figure. (The ≈
    // and the figure are sibling text nodes, so the matcher reads the cell.)
    const cellsSaying = (text: string) =>
      screen.queryAllByText((_, el) => el?.tagName === 'TD' && el.textContent === text);
    expect(cellsSaying('≈ £1100.00')).toHaveLength(2);
    expect(cellsSaying('£1200.00')).toHaveLength(0);
    expect(cellsSaying('≈ £1200.00')).toHaveLength(0);
    // The row itself still speaks the account's own currency.
    expect(screen.getByText('$200.00')).toBeInTheDocument();
  });

  it('shows a plain total when every row is already in the display currency', () => {
    render(
      <AccountBreakdownModal
        view="net"
        onClose={vi.fn()}
        rows={[rows[0]]}
        formatTotal={(v) => `£${v.toFixed(2)}`}
        onOpenAccount={vi.fn()}
      />
    );
    // Band total and net total, no ≈ anywhere.
    expect(screen.getAllByText('£1000.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/≈/)).not.toBeInTheDocument();
  });
});
