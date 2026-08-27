import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// Every figure invented. What these specs pin is the card's JUDGEMENT, not
// the readers (they have their own specs): the confirm step says what was
// found AND what was left out; a Money account with no matching account here
// is named, not vanished; and a position the file leaves open is excluded
// WHOLE unless ticked — importing its closing trades alone would fabricate a
// short position.

const { mockImportPrices, mockImportEvents } = vi.hoisted(() => ({
  mockImportPrices: vi.fn(),
  mockImportEvents: vi.fn()
}));

vi.mock('@data', () => ({
  dataPort: {
    importInvestmentPriceHistory: mockImportPrices,
    importInvestmentEvents: mockImportEvents
  }
}));

// STABLE references, deliberately: the card memoises its account matcher on
// the hook's return value, and the real hook memoises too. A mock that built
// a fresh array per render sent the plan effect into an infinite loop — the
// first draft of this file hung the runner exactly that way.
const OPEN_ACCOUNTS = [{ id: 'acct-open', name: 'Live Brokerage', isActive: true }];
const ALL_ACCOUNTS = [
  ...OPEN_ACCOUNTS,
  { id: 'acct-closed', name: 'Aged Brokerage', isActive: false }
];

vi.mock('../../contexts/AppContextSupabase', () => ({
  useApp: () => ({ accounts: OPEN_ACCOUNTS })
}));

// The closed accounts arrive through the hook; the traded accounts being
// mostly closed is the point of the feature.
vi.mock('../../hooks/useHistoricalAccounts', () => ({
  useHistoricalAccounts: () => ALL_ACCOUNTS
}));

const event = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  accountName: 'Aged Brokerage',
  symbol: 'ABC.L',
  securityName: 'Alphabet Soup Holdings',
  date: '2013-05-01',
  kind: 'buy',
  quantity: '500',
  price: '2.5',
  fees: null,
  amount: '1250',
  currency: 'GBP',
  sourceRef: 'guid-1',
  ...over
});

const { mockReadPrices, mockReadEvents } = vi.hoisted(() => ({
  mockReadPrices: vi.fn(),
  mockReadEvents: vi.fn()
}));

vi.mock('../../services/import/msMoney/mnyPrices', () => ({
  readMnyPriceHistory: mockReadPrices
}));

vi.mock('../../services/import/msMoney/mnyEvents', async (importOriginal) => ({
  // The real fold — its behaviour is part of what these specs exercise.
  ...(await importOriginal<Record<string, unknown>>()),
  readMnyEventHistory: mockReadEvents
}));

const { default: MnyHistoryImportCard } = await import('../MnyHistoryImportCard');

const priceHistory = (prices: Array<Record<string, unknown>>): Record<string, unknown> => ({
  prices,
  securities: new Set(prices.map((p) => p.symbol)).size,
  from: prices[0]?.date ?? null,
  to: prices[prices.length - 1]?.date ?? null,
  skipped: { noSymbol: 0, pence: 0, unreadable: 0, duplicates: 0 }
});

const eventHistory = (events: Array<Record<string, unknown>>, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  events,
  securities: new Set(events.map((e) => e.securityName)).size,
  accountNames: [...new Set(events.map((e) => e.accountName))],
  from: events[0]?.date ?? null,
  to: events[events.length - 1]?.date ?? null,
  skipped: { cashSide: 0, missingQuantity: 0, unreadable: 0 },
  figuresDisagree: 0,
  ...over
});

const chooseFile = (): void => {
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'ledger.mny');
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => Promise.resolve(new ArrayBuffer(3))
  });
  fireEvent.change(input, { target: { files: [file] } });
};

describe('MnyHistoryImportCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockImportPrices.mockResolvedValue(1);
    mockImportEvents.mockResolvedValue(2);
  });

  it('confirms both lanes with counts, and names dividends as cash already in the ledger', async () => {
    mockReadPrices.mockReturnValue(
      priceHistory([{ symbol: 'ABC.L', date: '2013-06-01', price: '2.6', currency: 'GBP' }])
    );
    mockReadEvents.mockReturnValue(
      eventHistory(
        [event(), event({ kind: 'sell', amount: '1400', sourceRef: 'guid-2' })],
        { skipped: { cashSide: 3, missingQuantity: 0, unreadable: 0 } }
      )
    );

    render(<MnyHistoryImportCard />);
    chooseFile();

    expect(await screen.findByText(/2 trades — buys, sells and write-offs/)).toBeInTheDocument();
    expect(screen.getByText(/1 price for 1 security/)).toBeInTheDocument();
    expect(screen.getByText(/3 dividend and cash rows already in your ledger/)).toBeInTheDocument();
    // A closed position: no open-position block, no tick-boxes.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('names a Money account no account here matches, and imports the rest', async () => {
    mockReadPrices.mockReturnValue(priceHistory([]));
    mockReadEvents.mockReturnValue(
      eventHistory([
        event(),
        event({ kind: 'sell', amount: '1400', sourceRef: 'guid-2' }),
        event({ accountName: 'Vanished Broker', sourceRef: 'guid-3' }),
        event({ accountName: 'Vanished Broker', kind: 'sell', sourceRef: 'guid-4' })
      ])
    );

    render(<MnyHistoryImportCard />);
    chooseFile();

    expect(
      await screen.findByText(/no account here matches: Vanished Broker \(2 trades\)/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Import this history' }));
    await waitFor(() => expect(mockImportEvents).toHaveBeenCalledTimes(1));
    const drafts = mockImportEvents.mock.calls[0][0] as Array<{ accountId: string; sourceRef: string }>;
    expect(drafts.map((d) => d.sourceRef)).toEqual(['guid-1', 'guid-2']);
    expect(drafts.every((d) => d.accountId === 'acct-closed')).toBe(true);
  });

  it('excludes an unticked open position WHOLE — never just its buys', async () => {
    mockReadPrices.mockReturnValue(priceHistory([]));
    mockReadEvents.mockReturnValue(
      eventHistory([
        // Closes: in.
        event(),
        event({ kind: 'sell', amount: '1400', sourceRef: 'guid-2' }),
        // Left open: out entirely unless ticked — buy AND partial sell.
        event({ securityName: 'Dangling Industries', symbol: 'DGL', sourceRef: 'guid-3' }),
        event({ securityName: 'Dangling Industries', symbol: 'DGL', kind: 'sell', quantity: '200', sourceRef: 'guid-4' })
      ])
    );

    render(<MnyHistoryImportCard />);
    chooseFile();

    expect(await screen.findByText(/left open by these trades/)).toBeInTheDocument();
    expect(screen.getByText(/Dangling Industries \(DGL\) — 300 units in Aged Brokerage/)).toBeInTheDocument();
    const box = screen.getByRole('checkbox');
    expect(box).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Import this history' }));
    await waitFor(() => expect(mockImportEvents).toHaveBeenCalledTimes(1));
    const drafts = mockImportEvents.mock.calls[0][0] as Array<{ sourceRef: string }>;
    expect(drafts.map((d) => d.sourceRef)).toEqual(['guid-1', 'guid-2']);
  });

  it('imports a ticked open position, and reports both lanes\' counts', async () => {
    mockReadPrices.mockReturnValue(
      priceHistory([{ symbol: 'DGL', date: '2013-06-01', price: '3', currency: 'GBP' }])
    );
    mockReadEvents.mockReturnValue(
      eventHistory([event({ securityName: 'Dangling Industries', symbol: 'DGL', sourceRef: 'guid-3' })])
    );

    render(<MnyHistoryImportCard />);
    chooseFile();

    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Import this history' }));

    await waitFor(() => expect(mockImportEvents).toHaveBeenCalledTimes(1));
    const drafts = mockImportEvents.mock.calls[0][0] as Array<{ sourceRef: string }>;
    expect(drafts.map((d) => d.sourceRef)).toEqual(['guid-3']);
    // 1 price + 2 events (the mock's answer) — counted from what was written.
    expect(await screen.findByRole('status')).toHaveTextContent('1 price and 2 trades imported');
  });
});
