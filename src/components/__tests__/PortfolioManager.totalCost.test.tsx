import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import PortfolioManager, { type HoldingFormValues, type PurchaseDetails } from '../PortfolioManager';
import type { Account } from '../../types';

/**
 * "THE TOTAL COST OF THE HOLDING" — the owner's 30 Aug ask:
 *
 *   "offer up the user the put in the unit price paid (as per current) or to
 *    offer them to put in the total cost of the holding and the system works
 *    out the unit price based from the total cost divided by the number of
 *    units. Make it a choice for the user. If they choose total cost then the
 *    charges box disappears as they cannot have the total cost and then add
 *    charges so its one or the other."
 *
 * Three things are worth a test rather than a reading, and they are the three
 * that would fail silently:
 *
 *  - the DIVISION, which must reach the save unrounded. Four places would look
 *    right on screen and lose sixty pounds of a £9,993 holding when the units
 *    are multiplied back out;
 *  - the CHARGES box, whose absence is the owner's ruling and not a layout
 *    preference — present it in total mode and a commission gets counted
 *    twice, once inside the total and once beside it;
 *  - the derived price SAID OUT LOUD, because a figure the app worked out for
 *    you is one you cannot check unless it is shown.
 *
 * Every symbol, name and figure invented — this repo is public.
 */

vi.mock('../StockSymbolSearch', () => ({
  default: ({ onManual }: {
    onSelect: (symbol: string, match: { name: string; type: string; exchange: string }) => void;
    onManual?: (typed: string) => void;
  }) => (
    <div>
      {onManual && (
        <button type="button" onClick={() => onManual('Rivermouth Index Acc')}>
          add typed text by hand
        </button>
      )}
    </div>
  ),
}));

const fetchQuotes = vi.fn(async () => ({
  quotes: new Map<string, never>(),
  errors: new Map<string, never>(),
}));
vi.mock('../../services/stockPriceService', () => ({
  fetchQuotes: (...args: unknown[]) => fetchQuotes(...args),
}));

// Typed with the real signature, so `mock.calls` needs no cast to be read.
const onAdd = vi.fn<(values: HoldingFormValues, purchase: PurchaseDetails) => Promise<void>>(
  async () => {}
);

/**
 * A cash account in the SAME currency as the portfolio, which is the only
 * kind the page ever offers (the list is filtered before it arrives here).
 * Same currency both sides keeps these tests about the division and nothing
 * else — the rate box has its own reasoning and its own coverage.
 */
const cashAccount: Account = {
  id: 'cash-1',
  name: 'Portfolio cash',
  type: 'current',
  balance: 25000,
  currency: 'GBP',
  lastUpdated: new Date('2025-01-02T00:00:00Z'),
};

const renderManager = (fundingAccounts: readonly Account[] = []): void => {
  render(
    <PreferencesProvider>
      <PortfolioManager
        holdings={[]}
        currency="GBP"
        fundingAccounts={fundingAccounts}
        onAdd={onAdd}
        onEdit={vi.fn(async () => {})}
        onDelete={vi.fn(async () => {})}
      />
    </PreferencesProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: /add your first holding/i }));
  // A hand-typed instrument: no quote is fetched for one, so the form settles
  // synchronously and stays in the account's own currency throughout.
  fireEvent.click(screen.getByRole('button', { name: 'add typed text by hand' }));
};

const added = (): [HoldingFormValues, PurchaseDetails] => {
  const call = onAdd.mock.calls[0];
  if (!call) throw new Error('nothing was added');
  return call;
};

const chooseTotalCost = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Total cost' }));
};

beforeEach(() => {
  onAdd.mockClear();
  fetchQuotes.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('the cost box asks which figure you have', () => {
  it('starts on the unit price, so nobody’s habits change', () => {
    renderManager();
    expect(screen.getByRole('button', { name: 'Unit price' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Total cost' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Average cost per unit')).toBeInTheDocument();
  });

  it('renames the field when the total is chosen', () => {
    renderManager();
    chooseTotalCost();
    expect(screen.getByRole('button', { name: 'Total cost' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Total cost of the holding')).toBeInTheDocument();
    expect(screen.queryByLabelText('Average cost per unit')).not.toBeInTheDocument();
  });

  it('empties the box on the way across: a unit price is not a total', () => {
    renderManager();
    fireEvent.change(screen.getByLabelText('Average cost per unit'), { target: { value: '1.1637' } });
    chooseTotalCost();
    expect(screen.getByLabelText('Total cost of the holding')).toHaveValue('');
  });
});

describe('the charges box is one or the other, never both', () => {
  it('is offered beside a unit price', () => {
    renderManager();
    expect(screen.getByLabelText(/^Charges/)).toBeInTheDocument();
  });

  it('is gone beside a total, which already includes them', () => {
    renderManager();
    chooseTotalCost();
    expect(screen.queryByLabelText(/^Charges/)).not.toBeInTheDocument();
  });

  it('saves no charges at all in total mode', async () => {
    renderManager();
    // Typed while the box was still on screen, then abandoned by the switch:
    // what is hidden must not quietly be spent.
    fireEvent.change(screen.getByLabelText(/^Charges/), { target: { value: '45.20' } });
    chooseTotalCost();
    fireEvent.change(screen.getByLabelText('Units held'), { target: { value: '8587.805' } });
    fireEvent.change(screen.getByLabelText('Total cost of the holding'), { target: { value: '9993.63' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add holding' }));

    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    const [, purchase] = added();
    expect(purchase.charges.toString()).toBe('0');
  });
});

describe('the unit price the total implies', () => {
  it('is shown under the field as soon as both figures are there', () => {
    renderManager();
    chooseTotalCost();
    fireEvent.change(screen.getByLabelText('Units held'), { target: { value: '8587.805' } });
    fireEvent.change(screen.getByLabelText('Total cost of the holding'), { target: { value: '9993.63' } });
    // 9,993.63 ÷ 8,587.805 = 1.1637001538…, shown at the four places a price
    // is quoted to.
    expect(screen.getByText('= £1.1637 a unit')).toBeInTheDocument();
  });

  it('says what it will do before it can do it', () => {
    renderManager();
    chooseTotalCost();
    fireEvent.change(screen.getByLabelText('Total cost of the holding'), { target: { value: '9993.63' } });
    expect(screen.getByText('Divided by the units above to give the price per unit.')).toBeInTheDocument();
  });

  it('reaches the save unrounded, so the units multiply back to the total', async () => {
    renderManager();
    chooseTotalCost();
    fireEvent.change(screen.getByLabelText('Units held'), { target: { value: '8587.805' } });
    fireEvent.change(screen.getByLabelText('Total cost of the holding'), { target: { value: '9993.63' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add holding' }));

    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    const [values] = added();

    // Every place the division produced, not the four a price is displayed to.
    expect(values.averageCost.toDecimalPlaces(10).toString()).toBe('1.1637001539');
    // The point of keeping them: the cost basis derived from this figure is
    // the money that was actually spent, to the penny.
    expect(values.averageCost.times(values.quantity).toDecimalPlaces(2).toString()).toBe('9993.63');
  });

  it('rounds nothing away on a division that never terminates', async () => {
    renderManager();
    chooseTotalCost();
    fireEvent.change(screen.getByLabelText('Units held'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Total cost of the holding'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add holding' }));

    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    const [values] = added();
    // £3.3333 a unit would be £9.9999 for the three of them. The stored figure
    // carries enough places that the tenner comes back a tenner.
    expect(values.averageCost.toDecimalPlaces(4).toString()).toBe('3.3333');
    expect(values.averageCost.times(values.quantity).toDecimalPlaces(2).toString()).toBe('10');
  });
});

describe('a funded buy entered as a total', () => {
  it('prefills Total paid with the figure that was typed, to the penny', async () => {
    renderManager([cashAccount]);
    chooseTotalCost();
    fireEvent.change(screen.getByLabelText('Units held'), { target: { value: '8587.805' } });
    fireEvent.change(screen.getByLabelText('Total cost of the holding'), { target: { value: '9993.63' } });
    fireEvent.change(screen.getByLabelText('Paid from'), { target: { value: cashAccount.id } });

    // The prefill must be the typed total itself and not units × the derived
    // price, which can land a hundredth of a penny away and would show the
    // owner a figure they did not type.
    const totalPaid = await screen.findByLabelText('Total paid (GBP)');
    await waitFor(() => expect(totalPaid).toHaveValue('9,993.63'));

    fireEvent.click(screen.getByRole('button', { name: 'Add holding' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    const [, purchase] = added();
    expect(purchase.totalPaid?.toString()).toBe('9993.63');
    expect(purchase.fundingAccountId).toBe(cashAccount.id);
  });
});

describe('refusals', () => {
  it('names the total, not the average cost, when the box is empty', async () => {
    renderManager();
    chooseTotalCost();
    fireEvent.change(screen.getByLabelText('Units held'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add holding' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Total cost must be a positive amount');
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('asks for the units before it will divide by them', async () => {
    renderManager();
    chooseTotalCost();
    fireEvent.change(screen.getByLabelText('Total cost of the holding'), { target: { value: '9993.63' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add holding' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Units must be a positive number');
    expect(onAdd).not.toHaveBeenCalled();
  });
});
