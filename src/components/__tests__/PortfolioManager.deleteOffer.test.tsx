import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import PortfolioManager, { type HoldingTraceOffer } from '../PortfolioManager';
import { toDecimal } from '../../utils/decimal';
import type { InvestmentHolding } from '../../services/investments/holding';

/**
 * THE DELETE, WITH ITS OFFER (owner, 1 Sep 2026: "offer to help delete all
 * trace of it ever existing").
 *
 * The rules these pin:
 *
 *  - deleting opens a dialog, never window.confirm — an offer needs a tick;
 *  - the rows the holding's own trades wrote are listed by amount and date,
 *    and the tick (default ON) sends their ids with the delete;
 *  - unticking sends none — the ledger's rows are the owner's to keep;
 *  - with nothing to offer, the dialog says the transfer stays instead of
 *    showing an empty tick.
 *
 * Every symbol, account and figure invented — this repo is public.
 */

vi.mock('../StockSymbolSearch', () => ({
  default: () => <div>symbol search</div>,
}));

vi.mock('../../services/stockPriceService', () => ({
  fetchQuotes: vi.fn(async () => ({ quotes: new Map(), errors: new Map() })),
}));

vi.mock('../../hooks/useFxQuote', () => ({
  useFxQuote: () => ({ status: 'unavailable' }),
}));

const HOLDING: InvestmentHolding = {
  id: 'hold-1',
  accountId: 'acc-invest',
  symbol: 'SYNTHCO',
  name: 'Synthetic Corp',
  quantity: toDecimal(100),
  costBasis: toDecimal(1000),
  averageCost: toDecimal(10),
  currentPrice: null,
  marketValue: null,
  currency: 'GBP',
  assetType: 'stock',
  purchaseDate: null,
  purchasePrice: null,
  priceAsOf: null,
  notes: null,
};

const OFFERS: HoldingTraceOffer[] = [
  { id: 'row-buy', description: 'Buy 100.0000 SYNTHCO', date: '2026-08-28', amount: 1000 },
  { id: 'row-gain', description: 'Realised gain — SYNTHCO', date: '2026-08-30', amount: 12.5 },
];

const onDelete = vi.fn<(id: string, traceRowIds: readonly string[]) => Promise<void>>(
  async () => {}
);

const renderManager = (offers: HoldingTraceOffer[] = OFFERS) => {
  render(
    <PreferencesProvider>
      <PortfolioManager
        holdings={[HOLDING]}
        currency="GBP"
        fundingAccounts={[]}
        onAdd={vi.fn(async () => {})}
        onEdit={vi.fn(async () => {})}
        onDelete={onDelete}
        traceRowsFor={vi.fn(async () => offers)}
      />
    </PreferencesProvider>
  );
};

const openDialog = async (): Promise<void> => {
  fireEvent.click(screen.getByRole('button', { name: /remove synthco/i }));
  await screen.findByText(/register row/);
};

afterEach(() => vi.clearAllMocks());

describe('deleting a holding offers the rows its trades wrote', () => {
  it('lists every offered row by amount and date, tick on by default', async () => {
    renderManager();
    await openDialog();
    expect(screen.getByText(/Buy 100\.0000 SYNTHCO — .*1,000\.00, 28\/08\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/Realised gain — SYNTHCO — .*12\.50, 30\/08\/2026/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
    // The refusal rule, named where the choice is made.
    expect(screen.getByText(/redated or reworded is not listed and stays/)).toBeInTheDocument();
  });

  it('confirming with the tick sends the offered ids along with the delete', async () => {
    renderManager();
    await openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Remove holding' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('hold-1', ['row-buy', 'row-gain']));
  });

  it('unticking keeps the ledger: the delete goes out with no rows', async () => {
    renderManager();
    await openDialog();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove holding' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('hold-1', []));
  });

  it('with nothing to offer, says the transfer stays rather than showing an empty tick', async () => {
    renderManager([]);
    fireEvent.click(screen.getByRole('button', { name: /remove synthco/i }));
    expect(
      await screen.findByText(/Any purchase transfer stays in the registers/)
    ).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('cancel closes the dialog and deletes nothing', async () => {
    renderManager();
    await openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByText(/register row/)).not.toBeInTheDocument();
  });
});
