import { describe, it, expect } from 'vitest';
import { compareChronological, compareTransactions, transactionSortValue } from './transactionSort';
import type { Transaction, Category } from '../types';

const cats: Category[] = [
  { id: 'c-food', name: 'Food', type: 'expense', level: 'detail' },
  { id: 'c-salary', name: 'Salary', type: 'income', level: 'detail' }
];

const t = (over: Partial<Transaction>): Transaction => ({
  id: 'x',
  date: new Date('2024-01-15'),
  description: 'x',
  amount: -10,
  type: 'expense',
  accountId: 'a',
  category: '',
  cleared: false,
  ...over
}) as Transaction;

const orderedIds = (
  txns: Transaction[],
  field: Parameters<typeof compareTransactions>[2],
  dir: 'asc' | 'desc'
) => [...txns].sort((a, b) => compareTransactions(a, b, field, dir, cats)).map(x => x.id);

describe('compareTransactions', () => {
  it('orders by signed amount for amount / payment / deposit', () => {
    const list = [t({ id: 'a', amount: -50 }), t({ id: 'b', amount: 200 }), t({ id: 'c', amount: -10 })];
    expect(orderedIds(list, 'amount', 'asc')).toEqual(['a', 'c', 'b']); // -50, -10, 200
    expect(orderedIds(list, 'payment', 'asc')).toEqual(['a', 'c', 'b']);
    expect(orderedIds(list, 'deposit', 'desc')).toEqual(['b', 'c', 'a']); // 200, -10, -50
  });

  it('orders by resolved category name (case-insensitive; uncategorised first)', () => {
    const list = [
      t({ id: 's', category: 'c-salary' }),
      t({ id: 'f', category: 'c-food' }),
      t({ id: 'u', category: '' })
    ];
    expect(orderedIds(list, 'category', 'asc')).toEqual(['u', 'f', 's']); // '', food, salary
  });

  it('orders by description case-insensitively', () => {
    const list = [
      t({ id: 'z', description: 'zebra' }),
      t({ id: 'a', description: 'Apple' }),
      t({ id: 'm', description: 'mango' })
    ];
    expect(orderedIds(list, 'description', 'asc')).toEqual(['a', 'm', 'z']);
  });

  it('orders by tags', () => {
    const list = [t({ id: 'b', tags: ['work'] }), t({ id: 'a', tags: ['bills'] }), t({ id: 'n', tags: [] })];
    expect(orderedIds(list, 'tags', 'asc')).toEqual(['n', 'a', 'b']); // '', bills, work
  });

  it('orders by date chronologically, days newest-first under desc', () => {
    const list = [
      t({ id: 'newer', date: new Date('2024-03-01'), createdAt: new Date('2024-03-01T10:00:00Z') }),
      t({ id: 'newest', date: new Date('2024-03-01'), createdAt: new Date('2024-03-01T11:00:00Z') }),
      t({ id: 'old', date: new Date('2024-01-01') })
    ];
    expect(orderedIds(list, 'date', 'asc')).toEqual(['old', 'newer', 'newest']);
    // desc reverses the WHOLE order, tie-break included — it has to, because the
    // running Balance beside each row is the balance AFTER it, so newest-first
    // must be the exact reverse of the order the balances were accumulated in.
    // Reversing only the day is what put a day's first transaction on top
    // wearing the account's balance.
    expect(orderedIds(list, 'date', 'desc')).toEqual(['newest', 'newer', 'old']);
  });

  it('reverses exactly under desc, so the first row is the last chronologically', () => {
    const list = [
      t({ id: 'a', date: new Date('2024-01-01'), type: 'income' }),
      t({ id: 'b', date: new Date('2024-01-01'), type: 'expense' }),
      t({ id: 'c', date: new Date('2024-01-01'), type: 'expense', createdAt: new Date('2024-01-01T09:00:00Z') }),
      t({ id: 'd', date: new Date('2024-02-01'), type: 'transfer' })
    ];
    const ascending = orderedIds(list, 'date', 'asc');
    expect(orderedIds(list, 'date', 'desc')).toEqual([...ascending].reverse());
  });

  it('does not order a day by transaction type', () => {
    // On a swept account the payment OUT precedes the sweep IN that offsets it.
    // Credits do not precede debits, so nothing here may claim they do — the
    // type must not move a row at all. Both rows carry the same createdAt (one
    // bulk-imported file shares one), leaving the id as the only separator:
    // alphabetical, and identical whichever type is which.
    const entered = new Date('2024-02-19T02:00:00Z');
    const day = new Date('2024-02-19');
    const asFiled = [
      t({ id: 'aaa', date: day, type: 'income', amount: 450, createdAt: entered }),
      t({ id: 'zzz', date: day, type: 'expense', amount: -450, createdAt: entered })
    ];
    const typesSwapped = [
      t({ id: 'aaa', date: day, type: 'expense', amount: -450, createdAt: entered }),
      t({ id: 'zzz', date: day, type: 'income', amount: 450, createdAt: entered })
    ];

    expect(orderedIds(asFiled, 'date', 'asc')).toEqual(['aaa', 'zzz']);
    expect(orderedIds(typesSwapped, 'date', 'asc')).toEqual(['aaa', 'zzz']);
  });

  it('cannot be reordered by type when two transfers share a day', () => {
    // The standing order and the evening sweep are BOTH transfers, and the sweep
    // comes last. No type rule can express that — only the bank's own sequence
    // can, and it must beat every other signal including a createdAt that says
    // the opposite.
    const day = new Date('2024-02-05');
    const list = [
      t({ id: 'sweep', date: day, type: 'transfer', amount: 312.75, statementSequence: 2, createdAt: new Date('2020-01-01') }),
      t({ id: 'standing-order', date: day, type: 'transfer', amount: -300, statementSequence: 1, createdAt: new Date('2020-01-02') }),
      t({ id: 'direct-debit', date: day, type: 'expense', amount: -12.75, statementSequence: 0, createdAt: new Date('2020-01-03') })
    ];

    expect(orderedIds(list, 'date', 'asc')).toEqual(['direct-debit', 'standing-order', 'sweep']);
    expect(orderedIds(list, 'date', 'desc')).toEqual(['sweep', 'standing-order', 'direct-debit']);
  });

  it('exposes the comparable value via transactionSortValue', () => {
    expect(transactionSortValue(t({ amount: -5 }), 'payment', cats)).toBe(-5);
    expect(transactionSortValue(t({ category: 'c-food' }), 'category', cats)).toBe('food');
  });

  it('tie-breaks equal non-date values chronologically (oldest first)', () => {
    // Three O2 rows + one Amazon row: description sort groups the O2 rows and
    // orders them by date within the group, regardless of input order.
    const list = [
      t({ id: 'o2-new', description: 'O2', date: new Date('2024-03-10') }),
      t({ id: 'amazon', description: 'Amazon', date: new Date('2024-02-01') }),
      t({ id: 'o2-old', description: 'O2', date: new Date('2024-01-05') }),
      t({ id: 'o2-mid', description: 'O2', date: new Date('2024-02-15') })
    ];
    expect(orderedIds(list, 'description', 'asc')).toEqual(['amazon', 'o2-old', 'o2-mid', 'o2-new']);
    // desc flips the groups, not the within-group date order
    expect(orderedIds(list, 'description', 'desc')).toEqual(['o2-old', 'o2-mid', 'o2-new', 'amazon']);
  });

  it('tie-breaks equal amounts chronologically too', () => {
    const list = [
      t({ id: 'b', amount: -10, date: new Date('2024-02-01') }),
      t({ id: 'a', amount: -10, date: new Date('2024-01-01') }),
      t({ id: 'c', amount: -99, date: new Date('2024-03-01') })
    ];
    expect(orderedIds(list, 'amount', 'asc')).toEqual(['c', 'a', 'b']); // -99, then the -10s oldest-first
  });

  it('uses entry order as the final tie-break on a non-date column', () => {
    const list = [
      t({ id: 'later', description: 'O2', date: new Date('2024-01-05'), createdAt: new Date('2024-01-06T12:00:00Z') }),
      t({ id: 'earlier', description: 'O2', date: new Date('2024-01-05'), createdAt: new Date('2024-01-05T12:00:00Z') })
    ];
    expect(orderedIds(list, 'description', 'asc')).toEqual(['earlier', 'later']);
  });
});

describe('compareChronological', () => {
  const chronological = (txns: Transaction[]): string[] =>
    [...txns].sort(compareChronological).map(x => x.id);

  it('settles same-day rows the same way whatever order they arrive in', () => {
    // The defect this replaces: two arrays filtered from the same source (the
    // full history for the balances, the visible subset for the rows) were left
    // to Array.prototype.sort's stability, which answers with whatever order it
    // was handed.
    const day = new Date('2024-05-01');
    const list = [
      t({ id: 'zzz', date: day, type: 'expense' }),
      t({ id: 'aaa', date: day, type: 'income' }),
      t({ id: 'mmm', date: day, type: 'transfer' })
    ];
    expect(chronological(list)).toEqual(['aaa', 'mmm', 'zzz']);
    expect(chronological([...list].reverse())).toEqual(['aaa', 'mmm', 'zzz']);
  });

  it('orders same-day rows by when they were entered, ahead of the id', () => {
    const day = new Date('2024-05-01');
    const list = [
      t({ id: 'aaa', date: day, type: 'expense', createdAt: new Date('2024-05-02T18:00:00Z') }),
      t({ id: 'zzz', date: day, type: 'expense', createdAt: new Date('2024-05-01T09:00:00Z') })
    ];
    expect(chronological(list)).toEqual(['zzz', 'aaa']);
  });

  it('reads a createdAt that arrived from the wire as a string', () => {
    // PostgREST sends created_at as text and nothing converts it, so the
    // declared Date is not what is in memory. Comparing the two shapes has to
    // work or the entry order silently stops applying to fetched rows.
    const day = new Date('2024-05-01');
    const wireRow = t({ id: 'aaa', date: day, type: 'expense' });
    Object.assign(wireRow, { createdAt: '2024-05-01T09:00:00Z' });
    const localRow = t({ id: 'zzz', date: day, type: 'expense', createdAt: new Date('2024-05-02T18:00:00Z') });

    expect(chronological([localRow, wireRow])).toEqual(['aaa', 'zzz']);
  });

  it('places rows with no creation time after those that have one', () => {
    const day = new Date('2024-05-01');
    const list = [
      t({ id: 'aaa', date: day, type: 'expense' }),
      t({ id: 'zzz', date: day, type: 'expense', createdAt: new Date('2024-05-01T09:00:00Z') })
    ];
    // 'zzz' wins on entry order despite losing on id — an unknown moment cannot
    // be placed among known ones, so it goes last, always.
    expect(chronological(list)).toEqual(['zzz', 'aaa']);
  });

  it('puts the bank\'s own sequence ahead of entry order and id', () => {
    const day = new Date('2024-02-05');
    // Ids and createdAt both say the opposite of the statement; the sequence
    // must win, or an imported day reads in an order the bank never printed.
    const list = [
      t({ id: 'aaa', date: day, statementSequence: 2, createdAt: new Date('2024-02-05T01:00:00Z') }),
      t({ id: 'mmm', date: day, statementSequence: 1, createdAt: new Date('2024-02-05T02:00:00Z') }),
      t({ id: 'zzz', date: day, statementSequence: 0, createdAt: new Date('2024-02-05T03:00:00Z') })
    ];
    expect(chronological(list)).toEqual(['zzz', 'mmm', 'aaa']);
  });

  it('sorts a row with no sequence after every row that has one', () => {
    // Unknown cannot be placed among known, so it goes last within its day —
    // which keeps the imported statement's own run contiguous, and it is that
    // run the user is checking line by line against the bank.
    const day = new Date('2024-02-05');
    const list = [
      t({ id: 'aaa-no-sequence', date: day, statementSequence: null }),
      t({ id: 'zzz-first-on-statement', date: day, statementSequence: 0 })
    ];
    expect(chronological(list)).toEqual(['zzz-first-on-statement', 'aaa-no-sequence']);
    // Two rows that both lack one fall through to the next tie-break, not to
    // whichever order they arrived in.
    const neither = [
      t({ id: 'zzz', date: day }),
      t({ id: 'aaa', date: day })
    ];
    expect(chronological(neither)).toEqual(['aaa', 'zzz']);
    expect(chronological([...neither].reverse())).toEqual(['aaa', 'zzz']);
  });

  it('ignores a sequence that is not a usable number', () => {
    // NaN would poison the comparator exactly as an unreadable date would.
    const day = new Date('2024-02-05');
    const broken = t({ id: 'broken', date: day, statementSequence: Number.NaN });
    const good = t({ id: 'good', date: day, statementSequence: 5 });

    expect(Number.isNaN(compareChronological(broken, good))).toBe(false);
    expect(chronological([broken, good])).toEqual(['good', 'broken']);
  });

  it('never returns NaN for an unreadable date', () => {
    // A NaN comparator is neither < 0 nor > 0, and sort is then free to return
    // any order at all — the exact failure mode this module exists to remove.
    const broken = t({ id: 'broken', date: new Date('not a date') });
    const good = t({ id: 'good', date: new Date('2024-05-01') });

    expect(Number.isNaN(compareChronological(broken, good))).toBe(false);
    expect(Number.isNaN(compareChronological(good, broken))).toBe(false);
    expect(compareChronological(broken, t({ ...broken, id: 'broken' }))).toBe(0);
    expect(chronological([good, broken])).toEqual(['broken', 'good']);
  });
});
