import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toDecimal } from '../../../utils/decimal';

/**
 * Holdings CRUD against public.investments.
 *
 * The behaviour worth pinning is not "it calls supabase" — it is the three
 * things that were wrong before this table was ever written to:
 *
 *   1. A save that silently does nothing. `Account.holdings` is not a column,
 *      so every holding was discarded. Every method here THROWS on failure.
 *   2. Numbers going over the wire as floats. Quantities carry eight decimal
 *      places and prices carry sub-penny values; both are sent as strings.
 *   3. cost_basis drifting from quantity × unit cost. It is derived, never
 *      taken from the caller.
 */

type Outcome = { data: unknown; error: { message: string; code?: string } | null };
type Operation = 'select' | 'insert' | 'update' | 'delete' | 'upsert';

interface Recorded {
  table: string;
  op: Operation;
  columns?: string;
  payload?: Record<string, unknown> | Array<Record<string, unknown>>;
  /** upsert only: the onConflict option, so a spec can pin the conflict key. */
  onConflict?: string;
  filters: Array<[string, unknown]>;
}

/**
 * A stand-in for the PostgREST query builder: chainable, and thenable so a call
 * that is awaited without .single() resolves too (list, delete, applyQuotes).
 */
class QueryDouble implements PromiseLike<Outcome> {
  constructor(private readonly outcome: Outcome, private readonly record: Recorded) {}

  select(columns?: string): this {
    if (columns !== undefined) this.record.columns = columns;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.record.filters.push([column, value]);
    return this;
  }

  order(): this {
    return this;
  }

  single(): Promise<Outcome> {
    return Promise.resolve(this.outcome);
  }

  maybeSingle(): Promise<Outcome> {
    return Promise.resolve(this.outcome);
  }

  then<TResult1 = Outcome, TResult2 = never>(
    onfulfilled?: ((value: Outcome) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.outcome).then(onfulfilled, onrejected);
  }
}

const ok = (data: unknown): Outcome => ({ data, error: null });
const fails = (message: string): Outcome => ({ data: null, error: { message } });

const calls: Recorded[] = [];
/** Per-operation outcome queues; the last entry repeats once a queue empties. */
let outcomes: Partial<Record<Operation, Outcome[]>> = {};

const nextOutcome = (op: Operation): Outcome => {
  const queue = outcomes[op];
  if (!queue || queue.length === 0) return ok(null);
  return queue.length === 1 ? queue[0] : (queue.shift() as Outcome);
};

const build = (
  table: string,
  op: Operation,
  payload?: Record<string, unknown> | Array<Record<string, unknown>>,
  onConflict?: string
): QueryDouble => {
  const record: Recorded = { table, op, payload, filters: [] };
  if (onConflict !== undefined) record.onConflict = onConflict;
  calls.push(record);
  return new QueryDouble(nextOutcome(op), record);
};

const supabaseDouble = {
  from: (table: string) => ({
    select: (columns: string) => build(table, 'select', undefined).select(columns),
    insert: (payload: Record<string, unknown>) => build(table, 'insert', payload),
    update: (payload: Record<string, unknown>) => build(table, 'update', payload),
    upsert: (payload: Array<Record<string, unknown>>, options?: { onConflict?: string }) =>
      build(table, 'upsert', payload, options?.onConflict),
    delete: () => build(table, 'delete')
  })
};

vi.mock('../supabaseClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  supabase: supabaseDouble
}));

const { InvestmentService } = await import('../investmentService');

const USER = 'db-user-uuid';

const storedRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'inv-1',
  account_id: 'acct-1',
  symbol: 'SHEL.L',
  name: 'Shell plc',
  quantity: '250',
  cost_basis: '6500.00',
  current_price: '32.775',
  currency: 'GBP',
  asset_type: 'stock',
  purchase_date: '2024-03-01',
  purchase_price: '26.00',
  last_updated: '2026-08-08T16:35:00.000Z',
  notes: '',
  ...overrides
});

const lastCall = (op: Operation): Recorded => {
  const found = [...calls].reverse().find((call) => call.op === op);
  if (!found) throw new Error(`no ${op} was recorded`);
  return found;
};

beforeEach(() => {
  calls.length = 0;
  outcomes = {};
});

describe('list', () => {
  it('scopes the read to the user even though RLS already does', async () => {
    outcomes = { select: [ok([storedRow()])] };

    await InvestmentService.list(USER);

    const call = lastCall('select');
    expect(call.table).toBe('investments');
    // Defence in depth: a mis-routed id must fail to match a row rather than
    // resting on the policy alone.
    expect(call.filters).toContainEqual(['user_id', USER]);
  });

  it('reads numerics as Decimals and derives what is not stored', async () => {
    outcomes = { select: [ok([storedRow()])] };

    const [holding] = await InvestmentService.list(USER);

    expect(holding.quantity.toString()).toBe('250');
    expect(holding.costBasis.toString()).toBe('6500');
    expect(holding.averageCost.toString()).toBe('26');
    // Sub-penny price survives: 32.775, not 32.78.
    expect(holding.currentPrice?.toString()).toBe('32.775');
    expect(holding.marketValue?.toString()).toBe('8193.75');
    expect(holding.lastUpdated?.toISOString()).toBe('2026-08-08T16:35:00.000Z');
  });

  it('leaves market value null when nothing has priced the holding', async () => {
    outcomes = { select: [ok([storedRow({ current_price: null, last_updated: null })])] };

    const [holding] = await InvestmentService.list(USER);

    // null, never 0 — a zero would read as "this holding is worthless".
    expect(holding.currentPrice).toBeNull();
    expect(holding.marketValue).toBeNull();
  });

  it('drops a row that cannot be valued rather than showing it as zero units', async () => {
    outcomes = { select: [ok([storedRow(), storedRow({ id: 'inv-2', quantity: null })])] };

    const holdings = await InvestmentService.list(USER);

    expect(holdings.map((h) => h.id)).toEqual(['inv-1']);
  });

  it('throws when the read fails, instead of reporting an empty portfolio', async () => {
    outcomes = { select: [fails('permission denied')] };

    await expect(InvestmentService.list(USER)).rejects.toThrow('permission denied');
  });
});

describe('create', () => {
  it('derives cost_basis from quantity × unit cost', async () => {
    outcomes = { insert: [ok(storedRow())] };

    await InvestmentService.create(USER, {
      accountId: 'acct-1',
      symbol: 'shel.l',
      name: 'Shell plc',
      quantity: toDecimal('250'),
      averageCost: toDecimal('26'),
      currency: 'GBP',
      assetType: 'stock'
    });

    const payload = lastCall('insert').payload ?? {};
    expect(payload.cost_basis).toBe('6500');
    // Two numbers that must agree are two numbers that will not: the caller
    // never supplies cost_basis.
    expect(payload.quantity).toBe('250');
    expect(payload.purchase_price).toBe('26');
  });

  it('sends numerics as strings so nothing round-trips through a float', async () => {
    outcomes = { insert: [ok(storedRow())] };

    await InvestmentService.create(USER, {
      accountId: 'acct-1',
      symbol: 'FUND.L',
      name: 'A fund',
      quantity: toDecimal('12.34567891'),
      averageCost: toDecimal('3.4271'),
      currency: 'GBP'
    });

    const payload = lastCall('insert').payload ?? {};
    expect(payload.quantity).toBe('12.34567891');
    expect(payload.purchase_price).toBe('3.4271');
  });

  it('upper-cases the ticker and stamps the owner', async () => {
    outcomes = { insert: [ok(storedRow())] };

    await InvestmentService.create(USER, {
      accountId: 'acct-1',
      symbol: ' shel.l ',
      name: 'Shell plc',
      quantity: toDecimal('1'),
      averageCost: toDecimal('1'),
      currency: 'GBP'
    });

    const payload = lastCall('insert').payload ?? {};
    expect(payload.symbol).toBe('SHEL.L');
    expect(payload.user_id).toBe(USER);
    expect(payload.account_id).toBe('acct-1');
    expect(payload.asset_type).toBe('stock');
  });

  it('throws rather than pretending a rejected insert saved', async () => {
    outcomes = { insert: [fails('violates check constraint')] };

    await expect(
      InvestmentService.create(USER, {
        accountId: 'acct-1',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        quantity: toDecimal('1'),
        averageCost: toDecimal('1'),
        currency: 'USD'
      })
    ).rejects.toThrow('violates check constraint');
  });

  it('throws when the row cannot be read back, so no false confirmation is shown', async () => {
    outcomes = { insert: [ok({ id: 'inv-9' })] };

    await expect(
      InvestmentService.create(USER, {
        accountId: 'acct-1',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        quantity: toDecimal('1'),
        averageCost: toDecimal('1'),
        currency: 'USD'
      })
    ).rejects.toThrow(/could not be read back/);
  });
});

describe('update', () => {
  it('recomputes cost_basis when only the quantity changes', async () => {
    // findOne reads the current row first, then the update is written.
    outcomes = { select: [ok(storedRow())], update: [ok(storedRow({ quantity: '300' }))] };

    await InvestmentService.update(USER, 'inv-1', { quantity: toDecimal('300') });

    const payload = lastCall('update').payload ?? {};
    // 300 × the stored average cost of 26.
    expect(payload.cost_basis).toBe('7800');
    expect(payload.quantity).toBe('300');
  });

  it('recomputes cost_basis when only the unit cost changes', async () => {
    outcomes = { select: [ok(storedRow())], update: [ok(storedRow())] };

    await InvestmentService.update(USER, 'inv-1', { averageCost: toDecimal('30') });

    const payload = lastCall('update').payload ?? {};
    expect(payload.cost_basis).toBe('7500');
  });

  it('does not read the row at all for a change that cannot move the cost', async () => {
    outcomes = { update: [ok(storedRow({ name: 'Shell plc (renamed)' }))] };

    await InvestmentService.update(USER, 'inv-1', { name: 'Shell plc (renamed)' });

    expect(calls.filter((call) => call.op === 'select')).toHaveLength(0);
  });

  it('scopes the write by id AND user', async () => {
    outcomes = { update: [ok(storedRow())] };

    await InvestmentService.update(USER, 'inv-1', { notes: 'ISA' });

    const call = lastCall('update');
    expect(call.filters).toContainEqual(['id', 'inv-1']);
    expect(call.filters).toContainEqual(['user_id', USER]);
  });

  it('refuses to edit a holding that no longer exists', async () => {
    outcomes = { select: [ok(null)] };

    await expect(
      InvestmentService.update(USER, 'gone', { quantity: toDecimal('1') })
    ).rejects.toThrow(/no longer exists/);
  });
});

describe('remove', () => {
  it('deletes by id and user, and throws when the delete fails', async () => {
    outcomes = { delete: [ok(null)] };
    await InvestmentService.remove(USER, 'inv-1');
    expect(lastCall('delete').filters).toEqual([
      ['id', 'inv-1'],
      ['user_id', USER]
    ]);

    calls.length = 0;
    outcomes = { delete: [fails('network error')] };
    await expect(InvestmentService.remove(USER, 'inv-1')).rejects.toThrow('network error');
  });
});

describe('importPriceHistory', () => {
  it('files rows as import-provenance history, and existing days win', async () => {
    // ignoreDuplicates, not update: 'import' is the weakest provenance, so a
    // day already priced by a quote, a typed figure or a trade keeps what it
    // has, and a re-run of the same file is a no-op rather than a rewrite.
    outcomes = { upsert: [ok([{ id: 'p-1' }])] };

    const inserted = await InvestmentService.importPriceHistory(USER, [
      { symbol: 'RR.L', date: '2015-03-11', price: '9.5', currency: 'GBP' },
      { symbol: 'RR.L', date: '2015-04-02', price: '9.7', currency: 'GBP' }
    ]);

    const upsert = lastCall('upsert');
    expect(upsert.table).toBe('investment_prices');
    expect(upsert.onConflict).toBe('user_id,symbol,price_date');
    expect(upsert.payload).toEqual([
      { user_id: USER, symbol: 'RR.L', price_date: '2015-03-11', price: '9.5', currency: 'GBP', source: 'import' },
      { user_id: USER, symbol: 'RR.L', price_date: '2015-04-02', price: '9.7', currency: 'GBP', source: 'import' }
    ]);
    // One of two landed — the other day was already priced. Counted from the
    // rows actually written, never claimed from the batch.
    expect(inserted).toBe(1);
  });

  it('does nothing, and asks nothing, for an empty history', async () => {
    await InvestmentService.importPriceHistory(USER, []);
    expect(calls).toHaveLength(0);
  });

  it('throws when the write fails', async () => {
    outcomes = { upsert: [fails('permission denied')] };

    await expect(
      InvestmentService.importPriceHistory(USER, [
        { symbol: 'RR.L', date: '2015-03-11', price: '9.5', currency: 'GBP' }
      ])
    ).rejects.toThrow();
  });
});

describe('applyQuotes', () => {
  it('writes the price and its as-of date and nothing else', async () => {
    outcomes = { update: [ok([{ id: 'inv-1' }])] };

    await InvestmentService.applyQuotes(USER, [
      { symbol: 'SHEL.L', price: '32.775', asOf: '2026-08-08T16:35:00.000Z' }
    ]);

    const payload = lastCall('update').payload ?? {};
    expect(payload.current_price).toBe('32.775');
    expect(payload.last_updated).toBe('2026-08-08T16:35:00.000Z');
    // A price refresh has no business touching the user's own data — and
    // market_value is derived, so a stored copy could only go stale.
    expect(Object.keys(payload).sort()).toEqual(['current_price', 'last_updated', 'updated_at']);
  });

  it('matches by symbol within the user, never across users', async () => {
    outcomes = { update: [ok([{ id: 'inv-1' }])] };

    await InvestmentService.applyQuotes(USER, [
      { symbol: 'SHEL.L', price: '32.775', asOf: '2026-08-08T16:35:00.000Z' }
    ]);

    expect(lastCall('update').filters).toEqual([
      ['user_id', USER],
      ['symbol', 'SHEL.L']
    ]);
  });

  it('reports how many rows were actually repriced', async () => {
    outcomes = { update: [ok([{ id: 'inv-1' }, { id: 'inv-2' }])] };

    const updated = await InvestmentService.applyQuotes(USER, [
      { symbol: 'SHEL.L', price: '32.775', asOf: '2026-08-08T16:35:00.000Z' }
    ]);

    // Counted, not assumed: a symbol that matched nothing must not read as
    // success.
    expect(updated).toBe(2);
  });

  it('files the day\'s price as history, in the holding\'s own currency', async () => {
    // current_price is a snapshot that every refresh overwrites — which is
    // why the app could never answer "what was this worth on the 3rd of
    // June?". Every refresh now also lands one row per (user, symbol, day)
    // in investment_prices, the table the owner's Microsoft Money file
    // models (SP — measured 27 Aug 2026). Same-day refreshes REPLACE via
    // onConflict, because the day's price is one fact.
    outcomes = { update: [ok([{ id: 'inv-1', currency: 'USD' }])] };

    await InvestmentService.applyQuotes(USER, [
      { symbol: 'AAPL', price: '232.50', asOf: '2026-08-27T14:30:00.000Z' }
    ]);

    const upsert = lastCall('upsert');
    expect(upsert.table).toBe('investment_prices');
    expect(upsert.onConflict).toBe('user_id,symbol,price_date');
    expect(upsert.payload).toEqual([
      {
        user_id: USER,
        symbol: 'AAPL',
        price_date: '2026-08-27',
        price: '232.50',
        // The HOLDING row's currency, not a guess: prices live in the
        // security's currency, exactly as Money stored a measured sale in
        // the security's USD against a GBP register.
        currency: 'USD',
        source: 'quote'
      }
    ]);
  });

  it('records no history for a quote that matched no holding', async () => {
    // A stray quote for something the user no longer holds is not their
    // history.
    outcomes = { update: [ok([])] };

    await InvestmentService.applyQuotes(USER, [
      { symbol: 'GONE.L', price: '1.00', asOf: '2026-08-27T14:30:00.000Z' }
    ]);

    expect(calls.filter(c => c.op === 'upsert')).toHaveLength(0);
  });

  it('throws when the history write fails — the gap would surface months later', async () => {
    outcomes = {
      update: [ok([{ id: 'inv-1', currency: 'GBP' }])],
      upsert: [fails('permission denied')]
    };

    await expect(
      InvestmentService.applyQuotes(USER, [
        { symbol: 'SHEL.L', price: '32.775', asOf: '2026-08-27T14:30:00.000Z' }
      ])
    ).rejects.toThrow();
  });

  it('does nothing, and asks nothing, for an empty list', async () => {
    await InvestmentService.applyQuotes(USER, []);
    expect(calls).toHaveLength(0);
  });

  it('throws when a price write fails', async () => {
    outcomes = { update: [fails('deadlock detected')] };

    await expect(
      InvestmentService.applyQuotes(USER, [
        { symbol: 'SHEL.L', price: '32.775', asOf: '2026-08-08T16:35:00.000Z' }
      ])
    ).rejects.toThrow('deadlock detected');
  });
});

describe('importEvents', () => {
  const draft = {
    accountId: 'acct-1',
    symbol: 'ABC.L',
    securityName: 'Alphabet Soup Holdings',
    date: '2013-05-01',
    kind: 'buy' as const,
    quantity: '500',
    price: '2.5',
    fees: null,
    amount: '1250',
    currency: 'GBP',
    sourceRef: 'guid-1'
  };

  it('files rows keyed by the source ref, and rows already filed win', async () => {
    // ignoreDuplicates on (user, source_ref): every imported row carries the
    // originating program's own GUID, so a re-run of the same file is a no-op.
    outcomes = { upsert: [ok([{ id: 'e-1' }])] };

    const inserted = await InvestmentService.importEvents(USER, [
      draft,
      { ...draft, date: '2013-09-01', kind: 'sell', amount: '1390.05', fees: '9.95', sourceRef: 'guid-2' }
    ]);

    const upsert = lastCall('upsert');
    expect(upsert.table).toBe('investment_events');
    expect(upsert.onConflict).toBe('user_id,source_ref');
    expect(upsert.payload).toEqual([
      {
        user_id: USER,
        account_id: 'acct-1',
        symbol: 'ABC.L',
        security_name: 'Alphabet Soup Holdings',
        event_date: '2013-05-01',
        kind: 'buy',
        quantity: '500',
        price: '2.5',
        fees: null,
        amount: '1250',
        currency: 'GBP',
        source: 'import',
        source_ref: 'guid-1'
      },
      {
        user_id: USER,
        account_id: 'acct-1',
        symbol: 'ABC.L',
        security_name: 'Alphabet Soup Holdings',
        event_date: '2013-09-01',
        kind: 'sell',
        quantity: '500',
        price: '2.5',
        fees: '9.95',
        amount: '1390.05',
        currency: 'GBP',
        source: 'import',
        source_ref: 'guid-2'
      }
    ]);
    // One of two landed — the other was already filed. Counted from the rows
    // actually written, never claimed from the batch.
    expect(inserted).toBe(1);
  });

  it('does nothing, and asks nothing, for an empty batch', async () => {
    await InvestmentService.importEvents(USER, []);
    expect(calls).toHaveLength(0);
  });

  it('throws when the write fails', async () => {
    outcomes = { upsert: [fails('permission denied')] };

    await expect(InvestmentService.importEvents(USER, [draft])).rejects.toThrow();
  });
});

describe('listEvents', () => {
  it('reads one account\'s events oldest first, scoped by user AND account', async () => {
    outcomes = {
      select: [
        ok([
          {
            id: 'e-1',
            account_id: 'acct-1',
            symbol: 'ABC.L',
            security_name: 'Alphabet Soup Holdings',
            event_date: '2013-05-01',
            kind: 'buy',
            quantity: '500',
            price: '2.5',
            fees: null,
            amount: '1250',
            currency: 'GBP',
            source: 'import'
          }
        ])
      ]
    };

    const events = await InvestmentService.listEvents(USER, 'acct-1');

    const select = lastCall('select');
    expect(select.table).toBe('investment_events');
    expect(select.filters).toEqual([
      ['user_id', USER],
      ['account_id', 'acct-1']
    ]);
    expect(events).toEqual([
      {
        id: 'e-1',
        accountId: 'acct-1',
        symbol: 'ABC.L',
        securityName: 'Alphabet Soup Holdings',
        date: '2013-05-01',
        kind: 'buy',
        quantity: '500',
        price: '2.5',
        fees: null,
        amount: '1250',
        currency: 'GBP',
        source: 'import'
      }
    ]);
  });

  it('drops a row the mapper cannot make sense of rather than crashing the list', async () => {
    outcomes = { select: [ok([{ id: 'e-broken' }])] };

    const events = await InvestmentService.listEvents(USER, 'acct-1');
    expect(events).toEqual([]);
  });

  it('throws when the read fails', async () => {
    outcomes = { select: [fails('permission denied')] };

    await expect(InvestmentService.listEvents(USER, 'acct-1')).rejects.toThrow();
  });
});

describe('listAllEvents / listAllPrices — the valuation reads', () => {
  it('reads every event user-wide, scoped by user alone', async () => {
    outcomes = {
      select: [
        ok([
          {
            id: 'e-1',
            account_id: 'acct-1',
            symbol: 'ABC.L',
            security_name: 'Alphabet Soup Holdings',
            event_date: '2013-05-01',
            kind: 'buy',
            quantity: '500',
            price: '2.5',
            fees: null,
            amount: '1250',
            currency: 'GBP',
            source: 'import'
          }
        ])
      ]
    };

    const events = await InvestmentService.listAllEvents(USER);

    const select = lastCall('select');
    expect(select.table).toBe('investment_events');
    expect(select.filters).toEqual([['user_id', USER]]);
    expect(events).toHaveLength(1);
    expect(events[0].accountId).toBe('acct-1');
  });

  it('reads every price with its symbol and currency, scoped by user alone', async () => {
    outcomes = {
      select: [
        ok([{ symbol: 'ABC.L', price_date: '2013-06-01', price: '2.6', currency: 'GBP' }])
      ]
    };

    const prices = await InvestmentService.listAllPrices(USER);

    const select = lastCall('select');
    expect(select.table).toBe('investment_prices');
    expect(select.filters).toEqual([['user_id', USER]]);
    expect(prices).toEqual([
      { symbol: 'ABC.L', date: '2013-06-01', price: '2.6', currency: 'GBP' }
    ]);
  });

  it('throws when either read fails', async () => {
    outcomes = { select: [fails('permission denied')] };
    await expect(InvestmentService.listAllEvents(USER)).rejects.toThrow();

    outcomes = { select: [fails('permission denied')] };
    await expect(InvestmentService.listAllPrices(USER)).rejects.toThrow();
  });
});
