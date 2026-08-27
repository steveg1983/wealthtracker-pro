import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { toDecimal } from '../utils/decimal';
import type { InvestmentHolding } from '../services/investments/holding';

// Every figure invented; the register maths itself is pinned in
// holdingRegister.test.ts — these specs pin the WIRING: series in, lines
// drawn, a revalue written with manual provenance and the series re-read.

const { mockListPrices, mockRecordPrice, mockListEvents } = vi.hoisted(() => ({
  mockListPrices: vi.fn(),
  mockRecordPrice: vi.fn(),
  mockListEvents: vi.fn()
}));

vi.mock('@data', () => ({
  dataPort: {
    listInvestmentPrices: mockListPrices,
    recordInvestmentPrice: mockRecordPrice,
    listInvestmentEvents: mockListEvents
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
    // The constant-quantity path: no events recorded for this position.
    mockListEvents.mockResolvedValue([]);
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


describe('HoldingRegisterModal — the events derivation (slice 4)', () => {
  it('derives from events when the position has any, and keeps Revalue', async () => {
    mockListPrices.mockResolvedValue([]);
    mockListEvents.mockResolvedValue([
      {
        id: 'e-1',
        accountId: 'acct-1',
        symbol: 'RR.L',
        securityName: 'Rolls-Royce Holdings',
        date: '2026-01-10',
        kind: 'buy',
        quantity: '100',
        price: '10',
        fees: null,
        amount: '1000',
        currency: 'GBP',
        source: 'manual'
      },
      // Another symbol in the same account must NOT leak into this register.
      {
        id: 'e-2',
        accountId: 'acct-1',
        symbol: 'XYZ',
        securityName: 'Xylophone Group',
        date: '2026-02-01',
        kind: 'buy',
        quantity: '5',
        price: '1',
        fees: null,
        amount: '5',
        currency: 'GBP',
        source: 'manual'
      }
    ]);

    render(<HoldingRegisterModal holding={holding()} onClose={vi.fn()} onPricesChanged={vi.fn()} />);

    // The shared table's footer — the events derivation, one position only.
    expect(await screen.findByText(/Bought £1,000\.00 · Sold £0\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Still held: 100 units/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record price' })).toBeInTheDocument();
  });
});
