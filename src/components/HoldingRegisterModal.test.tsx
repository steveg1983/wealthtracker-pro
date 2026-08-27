import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { toDecimal } from '../utils/decimal';
import type { InvestmentHolding } from '../services/investments/holding';

// Every figure invented; the register maths itself is pinned in
// holdingRegister.test.ts — these specs pin the WIRING: series in, lines
// drawn, a revalue written with manual provenance and the series re-read.

const { mockListPrices, mockRecordPrice } = vi.hoisted(() => ({
  mockListPrices: vi.fn(),
  mockRecordPrice: vi.fn()
}));

vi.mock('@data', () => ({
  dataPort: {
    listInvestmentPrices: mockListPrices,
    recordInvestmentPrice: mockRecordPrice
  }
}));

const { default: HoldingRegisterModal } = await import('./HoldingRegisterModal');

const holding = (): InvestmentHolding => ({
  id: 'inv-1',
  accountId: 'acct-1',
  symbol: 'RR.L',
  name: 'Rolls-Royce Holdings',
  quantity: toDecimal('100'),
  costBasis: toDecimal('1000'),
  averageCost: toDecimal('10'),
  currentPrice: toDecimal('11'),
  marketValue: toDecimal('1100'),
  currency: 'GBP',
  assetType: 'stock',
  purchaseDate: new Date('2026-01-10T00:00:00Z'),
  purchasePrice: toDecimal('9.8'),
  lastUpdated: new Date('2026-08-01T00:00:00Z'),
  notes: ''
});

describe('HoldingRegisterModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the series and draws the derived register — buy first, value last', async () => {
    mockListPrices.mockResolvedValueOnce([
      { date: '2026-02-01', price: '11', source: 'quote' }
    ]);

    render(<HoldingRegisterModal holding={holding()} onClose={vi.fn()} onPricesChanged={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Buy')).toBeInTheDocument();
    });
    expect(mockListPrices).toHaveBeenCalledWith('RR.L');
    expect(screen.getByText('Revaluation — quoted')).toBeInTheDocument();
    // Value 100 × 11, gain vs the £1,000 cost.
    expect(screen.getByText(/Value £1,100\.00 · Gain £100\.00/)).toBeInTheDocument();
  });

  it('records a typed price as the day\'s figure and re-reads the series', async () => {
    mockListPrices.mockResolvedValue([]);
    mockRecordPrice.mockResolvedValue(undefined);
    const onPricesChanged = vi.fn();

    render(
      <HoldingRegisterModal holding={holding()} onClose={vi.fn()} onPricesChanged={onPricesChanged} />
    );
    await waitFor(() => expect(screen.getByText('Buy')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Price per unit/), { target: { value: '12.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record price' }));

    await waitFor(() => {
      expect(mockRecordPrice).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'RR.L', price: '12.5', currency: 'GBP' })
      );
    });
    // The series is read again so the new line lands where its date puts it,
    // and the page is told the snapshot may have moved.
    expect(mockListPrices).toHaveBeenCalledTimes(2);
    expect(onPricesChanged).toHaveBeenCalled();
  });

  it('refuses a price that is not a plain number, without calling the store', async () => {
    mockListPrices.mockResolvedValue([]);

    render(<HoldingRegisterModal holding={holding()} onClose={vi.fn()} onPricesChanged={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Buy')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Price per unit/), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record price' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/plain number/);
    expect(mockRecordPrice).not.toHaveBeenCalled();
  });
});
