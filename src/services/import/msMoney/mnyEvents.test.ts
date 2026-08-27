import { describe, it, expect } from 'vitest';
import { eventsFromMoneyTables, foldOpenPositions, type MnyEventRow } from './mnyEvents';

// Every figure here is invented. The SHAPES are measured from a real Money
// file (27 Aug 2026): quantity and unit price live on TRN_INV, not TRN;
// act=1 buy / act=2 sell / act=13 write-off are the three quantity-changing
// codes; dividends (act=3) and returns of capital (act=8) are cash rows; the
// register amount is signed (buys positive, sells negative) and reconciles
// with qty × price ± fees; sguid is a distinct plain GUID string per row.

const CRNC = new Map<number, string | null>([
  [18, 'GBP'],
  [45, 'USD']
]);

const sec = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  hsec: 1,
  szSymbol: 'RR.L',
  szFull: 'Rolls-Royce Holdings',
  hcrnc: 18,
  ...over
});

const acct = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  hacct: 7,
  szFull: 'Broker ISA',
  hcrnc: 18,
  ...over
});

const trn = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  htrn: 100,
  hacct: 7,
  hsec: 1,
  act: 1,
  dt: new Date('2014-02-05T00:00:00Z'),
  amt: 1012.5,
  sguid: 'guid-100',
  ...over
});

const inv = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  htrn: 100,
  qty: 100,
  dPrice: 10,
  amtCmn: 12.5,
  ...over
});

describe('eventsFromMoneyTables', () => {
  it('reads a buy — quantity and price from TRN_INV, amount as a positive magnitude', () => {
    const out = eventsFromMoneyTables([sec()], [acct()], [trn()], [inv()], CRNC);

    expect(out.events).toEqual([
      {
        accountName: 'Broker ISA',
        symbol: 'RR.L',
        securityName: 'Rolls-Royce Holdings',
        date: '2014-02-05',
        kind: 'buy',
        quantity: '100',
        price: '10',
        fees: '12.5',
        amount: '1012.5',
        currency: 'GBP',
        sourceRef: 'guid-100'
      }
    ]);
    expect(out.securities).toBe(1);
    expect(out.accountNames).toEqual(['Broker ISA']);
    expect(out.figuresDisagree).toBe(0);
  });

  it('reads a sell — Money\'s negative register amount becomes a magnitude', () => {
    // Measured convention: sell amt = −(qty × price − fees).
    const out = eventsFromMoneyTables(
      [sec()],
      [acct()],
      [trn({ act: 2, amt: -987.5 })],
      [inv()],
      CRNC
    );

    expect(out.events[0]).toMatchObject({ kind: 'sell', amount: '987.5', fees: '12.5' });
    expect(out.figuresDisagree).toBe(0);
  });

  it('reads a write-off — quantity gone, no price, zero amount', () => {
    // The measured file has one: a worthless delisting removed at act=13.
    const out = eventsFromMoneyTables(
      [sec()],
      [acct()],
      [trn({ act: 13, amt: 0 })],
      [inv({ dPrice: null, amtCmn: null })],
      CRNC
    );

    expect(out.events[0]).toMatchObject({
      kind: 'write_off',
      quantity: '100',
      price: null,
      fees: null,
      amount: '0'
    });
  });

  it('counts dividends and returns of capital as cash rows, never events', () => {
    // The owner's ruling: anything that does not change quantity is cash —
    // and those rows already exist in the ledger from the full migration.
    const out = eventsFromMoneyTables(
      [sec()],
      [acct()],
      [trn(), trn({ htrn: 101, act: 3, sguid: 'guid-101' }), trn({ htrn: 102, act: 8, sguid: 'guid-102' })],
      [inv()],
      CRNC
    );

    expect(out.events).toHaveLength(1);
    expect(out.skipped.cashSide).toBe(2);
  });

  it('keeps a symbol-less security, by name — its register is trades-only', () => {
    // 11 of the owner's securities carry no ticker; unlike prices (which key
    // the store by symbol), an event is keyed to account + name and stands.
    const out = eventsFromMoneyTables(
      [sec({ szSymbol: null, szFull: 'Apple' })],
      [acct()],
      [trn()],
      [inv()],
      CRNC
    );

    expect(out.events[0]).toMatchObject({ symbol: null, securityName: 'Apple' });
  });

  it('counts a buy whose TRN_INV row is missing rather than inventing a quantity', () => {
    const out = eventsFromMoneyTables([sec()], [acct()], [trn()], [], CRNC);

    expect(out.events).toHaveLength(0);
    expect(out.skipped.missingQuantity).toBe(1);
  });

  it('counts a row whose figures disagree, and imports it on the register amount', () => {
    // The register amount is authoritative; the drift is surfaced, not eaten.
    const out = eventsFromMoneyTables(
      [sec()],
      [acct()],
      [trn({ amt: 1500 })],
      [inv()],
      CRNC
    );

    expect(out.events[0]).toMatchObject({ amount: '1500' });
    expect(out.figuresDisagree).toBe(1);
  });

  it('sorts events by date and reports the range and account names', () => {
    const out = eventsFromMoneyTables(
      [sec(), sec({ hsec: 2, szSymbol: 'XYZ', szFull: 'Xylophone Group' })],
      [acct(), acct({ hacct: 8, szFull: 'Aged Brokerage' })],
      [
        trn({ htrn: 200, hsec: 2, hacct: 8, dt: new Date('2010-05-20T00:00:00Z'), sguid: 'guid-200' }),
        trn()
      ],
      [inv(), inv({ htrn: 200 })],
      CRNC
    );

    expect(out.events.map((e) => e.date)).toEqual(['2010-05-20', '2014-02-05']);
    expect(out.from).toBe('2010-05-20');
    expect(out.to).toBe('2014-02-05');
    expect(out.accountNames).toEqual(['Aged Brokerage', 'Broker ISA']);
    expect(out.securities).toBe(2);
  });
});

describe('foldOpenPositions', () => {
  const ev = (over: Partial<MnyEventRow> = {}): MnyEventRow => ({
    accountName: 'Broker ISA',
    symbol: 'RR.L',
    securityName: 'Rolls-Royce Holdings',
    date: '2014-02-05',
    kind: 'buy',
    quantity: '100',
    price: '10',
    fees: null,
    amount: '1000',
    currency: 'GBP',
    sourceRef: 'guid-1',
    ...over
  });

  it('says nothing about a position the events close', () => {
    // The measured norm: all 32 genuinely-closed positions fold to zero.
    expect(
      foldOpenPositions([ev(), ev({ kind: 'sell', sourceRef: 'guid-2' })])
    ).toEqual([]);
  });

  it('reports the units left when a buy is never sold', () => {
    expect(foldOpenPositions([ev(), ev({ kind: 'sell', quantity: '40', sourceRef: 'guid-2' })])).toEqual([
      {
        accountName: 'Broker ISA',
        symbol: 'RR.L',
        securityName: 'Rolls-Royce Holdings',
        quantity: '60'
      }
    ]);
  });

  it('lets a write-off close a position — the worthless-delisting case', () => {
    expect(
      foldOpenPositions([ev(), ev({ kind: 'write_off', sourceRef: 'guid-2' })])
    ).toEqual([]);
  });

  it('keeps the same symbol in two accounts as two positions', () => {
    const open = foldOpenPositions([ev(), ev({ accountName: 'Aged Brokerage', sourceRef: 'guid-2' })]);
    expect(open.map((p) => p.accountName)).toEqual(['Aged Brokerage', 'Broker ISA']);
  });
});
