import { describe, it, expect } from 'vitest';
import type { Transaction } from '../types';
import {
  suggestMerchantKey,
  summarisePayees,
  filterPayees,
  buildPayeeClusters,
  isPayeeSortField,
  orderClusters,
  sortPayees,
  withoutHiddenPayees,
  planRename,
  type RefusedSuggestions,
} from './payeeCleanup';
import {
  payeeHiddenDismissalKey,
  payeeLineDismissalKey,
  payeeMerchantDismissalKey,
} from './suggestionDismissals';

/**
 * The payee texts in these tests are the real shapes from the owner's
 * register: a card reference glued to a merchant domain, and a bank interest
 * line with the period baked into it. Both produce thousands of payees that
 * each occur exactly once, which is the problem the screen exists to fix.
 */
const txn = (over: Partial<Transaction> & { id: string; description: string }): Transaction => ({
  date: new Date('2026-03-01'),
  amount: -10,
  category: 'cat-1',
  accountId: 'acc-1',
  type: 'expense',
  ...over,
});

describe('suggestMerchantKey', () => {
  it('pulls the trailing domain out of a card reference', () => {
    expect(suggestMerchantKey('AMZNMKTPLACE*1X6DN8XF5 AMAZON.CO.UK')).toBe('AMAZON.CO.UK');
    expect(suggestMerchantKey('AMZNMKTPLACE*3W9NN1HR5 AMAZON.CO.UK')).toBe('AMAZON.CO.UK');
    expect(suggestMerchantKey('AMAZON.CO.UK*EI8DN58J5 AMAZON.CO.UK')).toBe('AMAZON.CO.UK');
  });

  it('finds the domain even when the reference is glued to it with no space', () => {
    expect(suggestMerchantKey('AMAZON.CO.UK*EI8DN58J5')).toBe('AMAZON.CO.UK');
  });

  it('drops a www. prefix so the site and the shop agree', () => {
    expect(suggestMerchantKey('WWW.TESCO.COM')).toBe('TESCO.COM');
  });

  it('uses the leading words when a date is baked into the line', () => {
    expect(suggestMerchantKey('DEBIT INTEREST TO 28FEB2026 INT')).toBe('DEBIT INTEREST TO');
    expect(suggestMerchantKey('DEBIT INTEREST TO 30APR2026 INT')).toBe('DEBIT INTEREST TO');
  });

  it('keeps money charged and money earned apart', () => {
    // Both are "interest", and merging them would file a charge as income.
    expect(suggestMerchantKey('CREDIT INTEREST TO 30APR2026 INT')).not.toBe(
      suggestMerchantKey('DEBIT INTEREST TO 30APR2026 INT')
    );
  });

  it('stops the prefix at the first token carrying a digit', () => {
    expect(suggestMerchantKey('TESCO STORES 3456')).toBe('TESCO STORES');
  });

  it('never uses more than three leading words', () => {
    expect(suggestMerchantKey('ONE TWO THREE FOUR FIVE')).toBe('ONE TWO THREE');
  });

  it('is case-insensitive about what it reads', () => {
    expect(suggestMerchantKey('  tesco stores 12  ')).toBe('TESCO STORES');
  });

  it('suggests nothing rather than inventing a grouping', () => {
    // A bare reference, and a two-letter acquirer prefix: grouping on either
    // would sweep unrelated merchants into one heap.
    expect(suggestMerchantKey('4471982')).toBeNull();
    expect(suggestMerchantKey('SQ *COFFEE SHOP')).toBeNull();
    expect(suggestMerchantKey('   ')).toBeNull();
  });
});

describe('summarisePayees', () => {
  const transactions: Transaction[] = [
    txn({ id: 't1', description: 'TESCO STORES', amount: -20, date: new Date('2026-01-05') }),
    txn({ id: 't2', description: 'TESCO STORES', amount: -30.5, date: new Date('2026-02-05') }),
    txn({ id: 't3', description: 'TESCO STORES', amount: 5, date: new Date('2026-03-05') }),
    txn({ id: 't4', description: 'BOOTS', amount: -100, date: new Date('2026-02-01') }),
  ];

  it('counts distinct payees, most common first', () => {
    const rows = summarisePayees(transactions);
    expect(rows.map((r) => r.description)).toEqual(['TESCO STORES', 'BOOTS']);
    expect(rows[0].count).toBe(3);
    expect(rows[1].count).toBe(1);
  });

  it('totals magnitudes exactly, without float drift', () => {
    const drifty = summarisePayees([
      txn({ id: 'a', description: 'X', amount: -0.1 }),
      txn({ id: 'b', description: 'X', amount: -0.2 }),
    ]);
    expect(drifty[0].total).toBe(0.3);
  });

  it('reports the real date range of each payee', () => {
    const [tesco] = summarisePayees(transactions);
    expect(tesco.earliest).toEqual(new Date('2026-01-05'));
    expect(tesco.latest).toEqual(new Date('2026-03-05'));
  });

  it('treats texts that differ only in case as different payees', () => {
    // A rename rewrites the exact stored string, so the row the user ticks
    // must be exactly the rows whose text they saw.
    const rows = summarisePayees([
      txn({ id: 'a', description: 'Tesco' }),
      txn({ id: 'b', description: 'TESCO' }),
    ]);
    expect(rows).toHaveLength(2);
  });

  it('ignores rows with no payee text at all', () => {
    const rows = summarisePayees([
      txn({ id: 'a', description: '' }),
      txn({ id: 'b', description: '   ' }),
      txn({ id: 'c', description: 'REAL' }),
    ]);
    expect(rows.map((r) => r.description)).toEqual(['REAL']);
  });

  it('does not let an unparseable date collapse the range to 1970', () => {
    const rows = summarisePayees([
      txn({ id: 'a', description: 'X', date: new Date('2026-05-01') }),
      txn({ id: 'b', description: 'X', date: new Date('not a date') }),
    ]);
    expect(rows[0].earliest).toEqual(new Date('2026-05-01'));
    expect(rows[0].latest).toEqual(new Date('2026-05-01'));
  });
});

describe('filterPayees', () => {
  const rows = summarisePayees([
    txn({ id: 'a', description: 'AMZNMKTPLACE*1X6DN8XF5 AMAZON.CO.UK' }),
    txn({ id: 'b', description: 'DEBIT INTEREST TO 28FEB2026 INT' }),
    txn({ id: 'c', description: 'BOOTS' }),
  ]);

  it('matches case-insensitively on the payee text', () => {
    expect(filterPayees(rows, 'amazon').map((r) => r.description)).toEqual([
      'AMZNMKTPLACE*1X6DN8XF5 AMAZON.CO.UK',
    ]);
  });

  it('matches on the suggested merchant too', () => {
    expect(filterPayees(rows, 'interest')).toHaveLength(1);
  });

  it('returns everything for an empty query', () => {
    expect(filterPayees(rows, '   ')).toHaveLength(3);
  });
});

describe('buildPayeeClusters', () => {
  const rows = summarisePayees([
    txn({ id: 'a', description: 'AMZNMKTPLACE*1X6DN8XF5 AMAZON.CO.UK' }),
    txn({ id: 'b', description: 'AMZNMKTPLACE*3W9NN1HR5 AMAZON.CO.UK' }),
    txn({ id: 'c', description: 'AMAZON.CO.UK*EI8DN58J5 AMAZON.CO.UK' }),
    txn({ id: 'd', description: 'DEBIT INTEREST TO 28FEB2026 INT' }),
    txn({ id: 'e', description: 'DEBIT INTEREST TO 30APR2026 INT' }),
    txn({ id: 'f', description: 'BOOTS' }),
  ]);

  it('gathers the references of one merchant into a single cluster', () => {
    const clusters = buildPayeeClusters(rows);
    const amazon = clusters.find((c) => c.key === 'AMAZON.CO.UK');
    expect(amazon?.members).toHaveLength(3);
    expect(amazon?.transactionCount).toBe(3);
  });

  it('offers the biggest win first', () => {
    expect(buildPayeeClusters(rows)[0].key).toBe('AMAZON.CO.UK');
  });

  it('leaves out a payee that is already spelled one way', () => {
    // BOOTS needs no cleanup; listing it as a suggestion would be noise.
    expect(buildPayeeClusters(rows).map((c) => c.key)).not.toContain('BOOTS');
  });
});

/**
 * The order the suggestions are read in — the owner's second ask: "perhaps have
 * the payees in more of a 'list' that you can scroll through, in alphabetical
 * order at least… Or even offer sort by alphabet or by transaction count?"
 *
 * The fixture is built so the two orders are exact opposites of each other:
 * ZEBRA has the most transactions and sorts last, ARROW has the fewest and
 * sorts first. Nothing here can pass by accident on a list that happens to be
 * in the right order already.
 */
describe('orderClusters', () => {
  const rows = summarisePayees([
    // ARROW — two payees, two transactions. The smallest win, the first name.
    txn({ id: 'a1', description: 'REF*11 ARROW.CO.UK' }),
    txn({ id: 'a2', description: 'REF*12 ARROW.CO.UK' }),
    // MIDDLE — two payees, three transactions.
    txn({ id: 'm1', description: 'REF*21 MIDDLE.CO.UK' }),
    txn({ id: 'm2', description: 'REF*21 MIDDLE.CO.UK' }),
    txn({ id: 'm3', description: 'REF*22 MIDDLE.CO.UK' }),
    // ZEBRA — two payees, four transactions. The biggest win, the last name.
    txn({ id: 'z1', description: 'REF*31 ZEBRA.CO.UK' }),
    txn({ id: 'z2', description: 'REF*31 ZEBRA.CO.UK' }),
    txn({ id: 'z3', description: 'REF*31 ZEBRA.CO.UK' }),
    txn({ id: 'z4', description: 'REF*32 ZEBRA.CO.UK' }),
  ]);

  const keys = (order: Parameters<typeof orderClusters>[1]): string[] =>
    orderClusters(buildPayeeClusters(rows), order).map((c) => c.key);

  it('puts the biggest tidy-up first when sorted by transactions', () => {
    expect(keys('transactions')).toEqual(['ZEBRA.CO.UK', 'MIDDLE.CO.UK', 'ARROW.CO.UK']);
  });

  it('puts the merchants in name order when sorted A–Z', () => {
    expect(keys('alphabetical')).toEqual(['ARROW.CO.UK', 'MIDDLE.CO.UK', 'ZEBRA.CO.UK']);
  });

  it('offers the same suggestions either way — sorting is not filtering', () => {
    // The number in the heading is the length of this list, so an order that
    // dropped or duplicated one would make the heading lie.
    expect([...keys('alphabetical')].sort()).toEqual([...keys('transactions')].sort());
  });

  it('leaves the caller\'s array alone', () => {
    // Every count on the screen is derived from the array this is handed. A
    // display choice that sorted it in place would reorder them underneath it.
    const clusters = buildPayeeClusters(rows);
    const before = clusters.map((c) => c.key);
    const sorted = orderClusters(clusters, 'alphabetical');

    expect(clusters.map((c) => c.key)).toEqual(before);
    expect(sorted).not.toBe(clusters);
  });

  it('is stable enough to say nothing surprising about an empty list', () => {
    expect(orderClusters([], 'alphabetical')).toEqual([]);
    expect(orderClusters([], 'transactions')).toEqual([]);
    expect(orderClusters([], 'most-payees')).toEqual([]);
    expect(orderClusters([], 'fewest-payees')).toEqual([]);
  });
});

describe('orderClusters by payee count', () => {
  // Shapes chosen so payee order and transaction order DISAGREE — the fixture
  // above has two payees everywhere, which would let a payee sort that secretly
  // read transaction counts pass every assertion.
  const rows = summarisePayees([
    // BROAD — three payees, three transactions: widest spread, smallest pile.
    txn({ id: 'b1', description: 'REF*41 BROAD.CO.UK' }),
    txn({ id: 'b2', description: 'REF*42 BROAD.CO.UK' }),
    txn({ id: 'b3', description: 'REF*43 BROAD.CO.UK' }),
    // HEAVY — two payees, five transactions: biggest pile, narrowest spread.
    txn({ id: 'h1', description: 'REF*51 HEAVY.CO.UK' }),
    txn({ id: 'h2', description: 'REF*51 HEAVY.CO.UK' }),
    txn({ id: 'h3', description: 'REF*51 HEAVY.CO.UK' }),
    txn({ id: 'h4', description: 'REF*52 HEAVY.CO.UK' }),
    txn({ id: 'h5', description: 'REF*52 HEAVY.CO.UK' }),
    // EQUAL — three payees, four transactions: ties BROAD on payees, so the
    // transaction pile decides between them.
    txn({ id: 'e1', description: 'REF*61 EQUAL.CO.UK' }),
    txn({ id: 'e2', description: 'REF*61 EQUAL.CO.UK' }),
    txn({ id: 'e3', description: 'REF*62 EQUAL.CO.UK' }),
    txn({ id: 'e4', description: 'REF*63 EQUAL.CO.UK' }),
  ]);

  const keys = (order: Parameters<typeof orderClusters>[1]): string[] =>
    orderClusters(buildPayeeClusters(rows), order).map((c) => c.key);

  it('puts the widest spread first under most payees, transactions breaking ties', () => {
    expect(keys('most-payees')).toEqual(['EQUAL.CO.UK', 'BROAD.CO.UK', 'HEAVY.CO.UK']);
  });

  it('puts the near-singletons first under fewest payees, transactions breaking ties', () => {
    expect(keys('fewest-payees')).toEqual(['HEAVY.CO.UK', 'EQUAL.CO.UK', 'BROAD.CO.UK']);
  });

  it('disagrees with the transaction order — payee count is its own question', () => {
    expect(keys('transactions')).toEqual(['HEAVY.CO.UK', 'EQUAL.CO.UK', 'BROAD.CO.UK']);
    expect(keys('most-payees')).not.toEqual(keys('transactions'));
  });
});

/**
 * The owner's complaint, in his words: "if you go through and you do not want
 * them the same for whatever good reason, they will continue to pop up in the
 * suggestions". These pin the fix at the only place it can be pinned — the
 * function that recomputes the suggestions from scratch every time the screen
 * opens. If a refusal is not applied HERE, it is not applied at all.
 */
describe('buildPayeeClusters — suggestions the user has refused', () => {
  const rows = summarisePayees([
    txn({ id: 'a', description: 'AMZNMKTPLACE*1X6DN8XF5 AMAZON.CO.UK' }),
    txn({ id: 'b', description: 'AMZNMKTPLACE*3W9NN1HR5 AMAZON.CO.UK' }),
    txn({ id: 'c', description: 'AMAZON.CO.UK*EI8DN58J5 AMAZON.CO.UK' }),
    txn({ id: 'd', description: 'DEBIT INTEREST TO 28FEB2026 INT' }),
    txn({ id: 'e', description: 'DEBIT INTEREST TO 30APR2026 INT' }),
  ]);

  const refusing = (over: Partial<RefusedSuggestions>): RefusedSuggestions => ({
    merchants: new Set<string>(),
    lines: new Set<string>(),
    ...over,
  });

  it('never offers a merchant the user refused, however often the screen re-runs', () => {
    const refused = refusing({
      merchants: new Set([payeeMerchantDismissalKey('AMAZON.CO.UK')]),
    });

    for (let run = 0; run < 3; run++) {
      const keys = buildPayeeClusters(rows, refused).map((c) => c.key);
      expect(keys).not.toContain('AMAZON.CO.UK');
      // And only that one: refusing a guess must not silence the others.
      expect(keys).toEqual(['DEBIT INTEREST TO']);
    }
  });

  it('stays refused when a new reference for that merchant arrives', () => {
    // The decision recorded is about the GROUPING, not about the payees that
    // happened to be under it on the day. A key built from the member set would
    // change the moment one import landed, and put the refused suggestion
    // straight back in front of the user who had already said no to it.
    const laterRows = summarisePayees([
      txn({ id: 'a', description: 'AMZNMKTPLACE*1X6DN8XF5 AMAZON.CO.UK' }),
      txn({ id: 'b', description: 'AMZNMKTPLACE*3W9NN1HR5 AMAZON.CO.UK' }),
      txn({ id: 'new', description: 'AMZNMKTPLACE*9QQ4RT2K1 AMAZON.CO.UK' }),
    ]);

    expect(
      buildPayeeClusters(laterRows, refusing({
        merchants: new Set([payeeMerchantDismissalKey('AMAZON.CO.UK')]),
      }))
    ).toEqual([]);
  });

  it('drops a refused payee from its suggestion and tells the truth about the rest', () => {
    const refused = refusing({
      lines: new Set([
        payeeLineDismissalKey('AMAZON.CO.UK', 'AMAZON.CO.UK*EI8DN58J5 AMAZON.CO.UK'),
      ]),
    });

    const amazon = buildPayeeClusters(rows, refused).find((c) => c.key === 'AMAZON.CO.UK');
    expect(amazon?.members.map((m) => m.description)).toEqual([
      'AMZNMKTPLACE*1X6DN8XF5 AMAZON.CO.UK',
      'AMZNMKTPLACE*3W9NN1HR5 AMAZON.CO.UK',
    ]);
    // The chip's own counts have to move with it, or the screen offers to
    // rename three payees and renames two.
    expect(amazon?.transactionCount).toBe(2);
  });

  it('stops offering a merchant whose refused payees leave nothing to merge', () => {
    const refused = refusing({
      lines: new Set([
        payeeLineDismissalKey('AMAZON.CO.UK', 'AMAZON.CO.UK*EI8DN58J5 AMAZON.CO.UK'),
        payeeLineDismissalKey('AMAZON.CO.UK', 'AMZNMKTPLACE*3W9NN1HR5 AMAZON.CO.UK'),
      ]),
    });

    // One payee left is not a cleanup, it is a single name spelled one way.
    expect(buildPayeeClusters(rows, refused).map((c) => c.key)).toEqual(['DEBIT INTEREST TO']);
  });

  it('keeps a refusal to the merchant it was made under', () => {
    // The same payee text filed against a different merchant is a different
    // statement, and must not silently hide this one.
    const refused = refusing({
      lines: new Set([
        payeeLineDismissalKey('DEBIT INTEREST TO', 'AMAZON.CO.UK*EI8DN58J5 AMAZON.CO.UK'),
      ]),
    });

    const amazon = buildPayeeClusters(rows, refused).find((c) => c.key === 'AMAZON.CO.UK');
    expect(amazon?.members).toHaveLength(3);
  });

  it('offers everything when nothing has been refused', () => {
    expect(buildPayeeClusters(rows, refusing({})).map((c) => c.key)).toEqual([
      'AMAZON.CO.UK', 'DEBIT INTEREST TO',
    ]);
  });
});

/**
 * The third refusal, and the widest: "never bring this payee to me again on
 * this page". Unlike the other two it is not about a suggestion at all — it
 * removes the payee from the summaries the whole screen is computed from, which
 * is the only way to make one promise cover the list, the suggestions and every
 * count on the page at once.
 */
describe('withoutHiddenPayees', () => {
  const rows = summarisePayees([
    txn({ id: 'a', description: 'AMZNMKTPLACE*1X6DN8XF5 AMAZON.CO.UK' }),
    txn({ id: 'b', description: 'AMZNMKTPLACE*3W9NN1HR5 AMAZON.CO.UK' }),
    txn({ id: 'c', description: 'AMAZON.CO.UK*EI8DN58J5 AMAZON.CO.UK' }),
    txn({ id: 'd', description: 'TFR 4471982' }),
  ]);

  it('drops exactly the payees hidden, and nothing that merely resembles them', () => {
    const hidden = new Set([payeeHiddenDismissalKey('AMAZON.CO.UK*EI8DN58J5 AMAZON.CO.UK')]);
    expect(withoutHiddenPayees(rows, hidden).map((p) => p.description)).toEqual([
      'AMZNMKTPLACE*1X6DN8XF5 AMAZON.CO.UK',
      'AMZNMKTPLACE*3W9NN1HR5 AMAZON.CO.UK',
      'TFR 4471982',
    ]);
  });

  it('hands the same array back when nothing is hidden', () => {
    // Not merely equal — the same array. A register can hold tens of thousands
    // of payees, and the common case must not copy them on every render.
    expect(withoutHiddenPayees(rows, new Set())).toBe(rows);
  });

  it('takes a hidden payee out of the suggestions and their counts as well', () => {
    const hidden = new Set([payeeHiddenDismissalKey('AMAZON.CO.UK*EI8DN58J5 AMAZON.CO.UK')]);
    const clusters = buildPayeeClusters(withoutHiddenPayees(rows, hidden));
    const amazon = clusters.find((c) => c.key === 'AMAZON.CO.UK');

    // The difference from "Leave out", which takes a payee out of one grouping
    // and leaves it in the list: this one is gone from both.
    expect(amazon?.members.map((m) => m.description)).toEqual([
      'AMZNMKTPLACE*1X6DN8XF5 AMAZON.CO.UK',
      'AMZNMKTPLACE*3W9NN1HR5 AMAZON.CO.UK',
    ]);
    expect(amazon?.transactionCount).toBe(2);
  });

  it('stops offering a suggestion whose hidden payees leave nothing to merge', () => {
    const hidden = new Set([
      payeeHiddenDismissalKey('AMAZON.CO.UK*EI8DN58J5 AMAZON.CO.UK'),
      payeeHiddenDismissalKey('AMZNMKTPLACE*3W9NN1HR5 AMAZON.CO.UK'),
    ]);
    expect(buildPayeeClusters(withoutHiddenPayees(rows, hidden))).toEqual([]);
  });

  it('is not confused by a refusal of another kind about the same payee', () => {
    // The three kinds are three statements. Refusing a payee's place in one
    // grouping says nothing about whether the payee belongs on the page.
    const notHidden = new Set([
      payeeLineDismissalKey('AMAZON.CO.UK', 'AMAZON.CO.UK*EI8DN58J5 AMAZON.CO.UK'),
      payeeMerchantDismissalKey('AMAZON.CO.UK'),
    ]);
    expect(withoutHiddenPayees(rows, notHidden)).toHaveLength(rows.length);
  });
});

/**
 * The payee list's own order — the owner's second ask, that the table's column
 * headers sort it.
 *
 * The fixture gives each column a DIFFERENT answer, so no test here can pass on
 * a list that happens to be in the right order already: `apple` has the most
 * transactions and the least money, `ZEBRA` the reverse, and the three payees
 * in the middle are a deliberate three-way tie on both numbers.
 */
describe('sortPayees', () => {
  const rows = summarisePayees([
    // Ten small transactions — busiest payee, smallest total. Lower case, to
    // hold the name orders to a case-blind comparison.
    ...Array.from({ length: 10 }, (_, i) => txn({
      id: `ap${i}`, description: 'apple grove 22', amount: -1,
    })),
    // One large REFUND. The biggest total on the page, and it is money coming
    // back — which has to rank with the money going out, not against it.
    txn({ id: 'z1', description: 'ZEBRA STORES 11', amount: 300, type: 'income' }),
    // No merchant can be read out of this one at all.
    ...Array.from({ length: 3 }, (_, i) => txn({
      id: `sq${i}`, description: 'SQ *NORTH CAFE', amount: -40,
    })),
    // Three payees tied on both numbers: 2 transactions, £50.
    ...Array.from({ length: 2 }, (_, i) => txn({
      id: `mi${i}`, description: 'MIDDLE MARKET 33', amount: -25,
    })),
    ...Array.from({ length: 2 }, (_, i) => txn({
      id: `ta${i}`, description: 'TIE ALPHA 44', amount: -25,
    })),
    ...Array.from({ length: 2 }, (_, i) => txn({
      id: `tb${i}`, description: 'TIE BRAVO 55', amount: -25,
    })),
  ]);

  const order = (field: 'payee' | 'merchant' | 'count' | 'total', direction: 'asc' | 'desc'):
    string[] => sortPayees(rows, field, direction).map((p) => p.description);

  /** The three-way tie, in the order the tie-break must always put them. */
  const TIED = ['MIDDLE MARKET 33', 'TIE ALPHA 44', 'TIE BRAVO 55'];

  it('reads the fixture the way the rest of this block assumes', () => {
    // Stated rather than trusted: every expectation below is about these
    // numbers, so a fixture that drifted would quietly weaken all of them.
    const by = new Map(rows.map((p) => [p.description, p]));
    expect(by.get('apple grove 22')?.count).toBe(10);
    expect(by.get('apple grove 22')?.total).toBe(10);
    expect(by.get('ZEBRA STORES 11')?.total).toBe(300);
    expect(by.get('SQ *NORTH CAFE')?.merchantKey).toBeNull();
  });

  it('sorts by payee name, blind to case', () => {
    expect(order('payee', 'asc')).toEqual([
      'apple grove 22', 'MIDDLE MARKET 33', 'SQ *NORTH CAFE',
      'TIE ALPHA 44', 'TIE BRAVO 55', 'ZEBRA STORES 11',
    ]);
    expect(order('payee', 'desc')).toEqual([...order('payee', 'asc')].reverse());
  });

  it('sorts by the merchant the payee looks like', () => {
    const named = (direction: 'asc' | 'desc'): string[] =>
      order('merchant', direction).filter((d) => d !== 'SQ *NORTH CAFE');

    expect(named('asc')).toEqual([
      'apple grove 22', 'MIDDLE MARKET 33', 'TIE ALPHA 44', 'TIE BRAVO 55', 'ZEBRA STORES 11',
    ]);
    expect(named('desc')).toEqual([...named('asc')].reverse());
  });

  it('keeps a payee with no merchant at the foot in both directions', () => {
    // An absence is not the smallest name, and the ASCENDING half is where that
    // has to be said: sorted as an empty string a payee with no merchant would
    // head the list, and the top of the screen would be dashes. Descending gets
    // the same answer for free, and is asserted so that a change which fixed
    // one direction by breaking the other cannot pass.
    expect(order('merchant', 'asc').at(-1)).toBe('SQ *NORTH CAFE');
    expect(order('merchant', 'desc').at(-1)).toBe('SQ *NORTH CAFE');
  });

  it('sorts transactions as numbers, not as text', () => {
    // 10 beats 3. Sorted as text it would sit between 1 and 2.
    expect(order('count', 'desc')).toEqual([
      'apple grove 22', 'SQ *NORTH CAFE', ...TIED, 'ZEBRA STORES 11',
    ]);
    expect(order('count', 'asc')).toEqual([
      'ZEBRA STORES 11', ...TIED, 'SQ *NORTH CAFE', 'apple grove 22',
    ]);
  });

  it('sorts by money, counting a refund at its size and not its sign', () => {
    // ZEBRA's only transaction is money coming BACK. On a screen about how much
    // traffic a payee has seen, £300 returned is as big as £300 spent.
    expect(order('total', 'desc')).toEqual([
      'ZEBRA STORES 11', 'SQ *NORTH CAFE', ...TIED, 'apple grove 22',
    ]);
    expect(order('total', 'asc')).toEqual([
      'apple grove 22', ...TIED, 'SQ *NORTH CAFE', 'ZEBRA STORES 11',
    ]);
  });

  it('breaks ties by payee name, the same way whichever direction the column is', () => {
    // The tie-break is not a second sort: reversing the column must not shuffle
    // the rows inside a run of equal figures.
    for (const field of ['count', 'total'] as const) {
      for (const direction of ['asc', 'desc'] as const) {
        const tied = order(field, direction).filter((d) => TIED.includes(d));
        expect(tied).toEqual(TIED);
      }
    }
  });

  it('leaves the caller\'s array alone', () => {
    // "Showing X of Y" and "select all shown" are counted off the array handed
    // in; a display choice must not reorder it underneath them.
    const before = rows.map((p) => p.description);
    const sorted = sortPayees(rows, 'payee', 'asc');

    expect(rows.map((p) => p.description)).toEqual(before);
    expect(sorted).not.toBe(rows);
  });

  it('opens on exactly the order the list has always had', () => {
    // The default the screen uses. Nothing may move until a header is clicked.
    expect(order('count', 'desc')).toEqual(rows.map((p) => p.description));
  });
});

describe('isPayeeSortField', () => {
  it('recognises the columns that are an order', () => {
    expect(['payee', 'merchant', 'count', 'total'].every(isPayeeSortField)).toBe(true);
  });

  it('refuses the ones that are not', () => {
    // The checkbox and the Leave out button are columns, and neither is
    // something a list can be put in order of. A cast would have believed them.
    expect(isPayeeSortField('pick')).toBe(false);
    expect(isPayeeSortField('leave-out')).toBe(false);
    expect(isPayeeSortField('')).toBe(false);
  });
});

describe('planRename', () => {
  const transactions: Transaction[] = [
    txn({ id: 't1', description: 'AMZNMKTPLACE*1X6DN8XF5 AMAZON.CO.UK' }),
    txn({ id: 't2', description: 'AMZNMKTPLACE*3W9NN1HR5 AMAZON.CO.UK' }),
    txn({ id: 't3', description: 'AMZNMKTPLACE*3W9NN1HR5 AMAZON.CO.UK' }),
    txn({ id: 't4', description: 'BOOTS' }),
  ];

  it('names every transaction behind the selected payees', () => {
    const plan = planRename(
      transactions,
      new Set(['AMZNMKTPLACE*1X6DN8XF5 AMAZON.CO.UK', 'AMZNMKTPLACE*3W9NN1HR5 AMAZON.CO.UK']),
      'Amazon'
    );
    expect(plan.transactionIds).toEqual(['t1', 't2', 't3']);
    expect(plan.payeesChanging).toBe(2);
    expect(plan.payeesUnchanged).toBe(0);
  });

  it('counts a payee already called the new name as unchanged, and writes nothing for it', () => {
    const plan = planRename(transactions, new Set(['BOOTS', 'AMZNMKTPLACE*1X6DN8XF5 AMAZON.CO.UK']), 'BOOTS');
    expect(plan.transactionIds).toEqual(['t1']);
    expect(plan.payeesChanging).toBe(1);
    expect(plan.payeesUnchanged).toBe(1);
  });

  it('plans nothing at all for a blank new name', () => {
    const plan = planRename(transactions, new Set(['BOOTS']), '   ');
    expect(plan.transactionIds).toEqual([]);
  });

  it('ignores surrounding whitespace in the new name', () => {
    // "  BOOTS  " and "BOOTS" are the same rename; the second must not be
    // reported as 1 payee changing and then write the same text back.
    const plan = planRename(transactions, new Set(['BOOTS']), '  BOOTS  ');
    expect(plan.payeesUnchanged).toBe(1);
    expect(plan.transactionIds).toEqual([]);
  });
});
