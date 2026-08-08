import { describe, it, expect } from 'vitest';
import type { Transaction } from '../types';
import {
  suggestMerchantKey,
  summarisePayees,
  filterPayees,
  buildPayeeClusters,
  planRename,
  type RefusedSuggestions,
} from './payeeCleanup';
import { payeeLineDismissalKey, payeeMerchantDismissalKey } from './suggestionDismissals';

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
