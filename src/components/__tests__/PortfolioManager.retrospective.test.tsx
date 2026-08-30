import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import PortfolioManager, { type HoldingFormValues, type PurchaseDetails } from '../PortfolioManager';

/**
 * RECORDING A PORTFOLIO THAT ALREADY EXISTS — the owner's 30 Aug findings,
 * from backfilling a real account's history by hand:
 *
 *  - "there is no 'start date' for purchasing my share": the Purchase date
 *    field only rendered when a funding account was chosen, so every
 *    backfilled holding silently dated TODAY — after every real price, which
 *    valued the lot at exactly zero delta;
 *  - "I need them to be to 4dp's": the cost parsed through money's 2dp
 *    rounding, turning a £0.0653 fund into £0.07;
 *  - "If I cannot find my particular stock or fund … I should be allowed to
 *    type my own text": the lookup was a closed list.
 *
 * Every symbol, name and figure invented — this repo is public.
 */

vi.mock('../StockSymbolSearch', () => ({
  default: ({ onSelect, onManual }: {
    onSelect: (symbol: string, match: { name: string; type: string; exchange: string }) => void;
    onManual?: (typed: string) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onSelect('SYNTH', { name: 'Synthetic Corp', type: 'equity', exchange: 'NASDAQ' })}
      >
        pick a synthetic instrument
      </button>
      {onManual && (
        <button type="button" onClick={() => onManual('My Backwater Fund')}>
          add typed text by hand
        </button>
      )}
    </div>
  ),
}));

const fetchQuotes = vi.fn(async () => ({
  quotes: new Map([['SYNTH', { symbol: 'SYNTH', price: 100, currency: 'GBP' }]]),
  errors: new Map(),
}));
vi.mock('../../services/stockPriceService', () => ({
  fetchQuotes: (...args: unknown[]) => fetchQuotes(...args),
}));

const onAdd = vi.fn(async () => {});

const renderManager = (): void => {
  render(
    <PreferencesProvider>
      <PortfolioManager
        holdings={[]}
        currency="GBP"
        fundingAccounts={[]}
        onAdd={onAdd}
        onEdit={vi.fn(async () => {})}
        onDelete={vi.fn(async () => {})}
      />
    </PreferencesProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: /add your first holding/i }));
};

const added = (): [HoldingFormValues, PurchaseDetails] => {
  const call = onAdd.mock.calls[0] as unknown as [HoldingFormValues, PurchaseDetails] | undefined;
  if (!call) throw new Error('nothing was added');
  return call;
};

beforeEach(() => {
  onAdd.mockClear();
  fetchQuotes.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('the purchase date belongs to every add, funded or not', () => {
  it('shows the date field with no funding account chosen', async () => {
    renderManager();
    fireEvent.click(screen.getByRole('button', { name: 'pick a synthetic instrument' }));
    expect(await screen.findByLabelText('Purchase date')).toBeInTheDocument();
  });

  it('hands the typed date to the save, so history lands where it happened', async () => {
    renderManager();
    fireEvent.click(screen.getByRole('button', { name: 'pick a synthetic instrument' }));
    fireEvent.change(screen.getByLabelText('Units held'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Average cost per unit'), { target: { value: '2' } });
    // A date safely in the past whatever the suite's clock says — typed the
    // way the field reads it, day first.
    const dateField = await screen.findByLabelText('Purchase date');
    fireEvent.change(dateField, { target: { value: '01/03/2019' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add holding' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    const [, purchase] = added();
    expect(purchase.date.getFullYear()).toBe(2019);
    expect(purchase.fundingAccountId).toBeNull();
  });
});

describe('a unit price keeps four places', () => {
  it('a fund priced at 0.0653 is stored as 0.0653, not 0.07', async () => {
    renderManager();
    fireEvent.click(screen.getByRole('button', { name: 'pick a synthetic instrument' }));
    fireEvent.change(screen.getByLabelText('Units held'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Average cost per unit'), { target: { value: '0.0653' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add holding' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    const [values] = added();
    expect(values.averageCost.toString()).toBe('0.0653');
  });
});

describe('an instrument the lookup does not know', () => {
  it('is added from the typed text, named editably, and never quoted', async () => {
    renderManager();
    fireEvent.click(screen.getByRole('button', { name: 'add typed text by hand' }));

    // The ticker convention: the symbol is the text, uppercased; the name
    // starts as what was typed and stays the owner's to change.
    expect(screen.getByText('MY BACKWATER FUND')).toBeInTheDocument();
    const nameField = screen.getByLabelText('Name');
    expect(nameField).toHaveValue('My Backwater Fund');
    fireEvent.change(nameField, { target: { value: 'Backwater Special Situations Acc' } });

    fireEvent.change(screen.getByLabelText('Units held'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Average cost per unit'), { target: { value: '1.2345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add holding' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalled());

    const [values] = added();
    expect(values.symbol).toBe('MY BACKWATER FUND');
    expect(values.name).toBe('Backwater Special Situations Acc');
    // Nothing to fetch: a hand-typed instrument has no quote, now or later.
    expect(fetchQuotes).not.toHaveBeenCalled();
  });
});
