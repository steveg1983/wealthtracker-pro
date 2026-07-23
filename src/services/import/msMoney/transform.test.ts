import { describe, it, expect } from 'vitest';
import { transformMsMoneyExport, type MnyExport } from './transform';

const NOW = '2026-07-20T12:00:00.000Z';

function build(over: Partial<MnyExport> = {}): MnyExport {
  return {
    accounts: [
      { id: 1, name: 'HSBC Current', moneyType: 'bank', currencyCode: 'GBP', openingBalance: '0', reconstructedBalance: '150.50', closed: false, openDate: '2010-01-01', closeDate: null, comment: null },
      { id: 2, name: 'Old Savings', moneyType: 'bank', currencyCode: 'GBP', openingBalance: '0', reconstructedBalance: '0', closed: true, openDate: '2009-01-01', closeDate: '2015-06-01', comment: 'closed' },
      { id: 3, name: 'Amex', moneyType: 'credit', currencyCode: 'GBP', openingBalance: '0', reconstructedBalance: '-27368.77', closed: false, openDate: '2012-01-01', closeDate: null, comment: null },
    ],
    categories: [
      { id: 130, name: 'INCOME', parentId: null, level: 0, fullPath: 'INCOME', hidden: false, kind: 'income' },
      { id: 131, name: 'EXPENSE', parentId: null, level: 0, fullPath: 'EXPENSE', hidden: false, kind: 'expense' },
      { id: 200, name: 'Bills', parentId: 131, level: 1, fullPath: 'EXPENSE : Bills', hidden: false, kind: 'expense' },
      { id: 201, name: 'Telephone', parentId: 200, level: 2, fullPath: 'EXPENSE : Bills : Telephone', hidden: false, kind: 'expense' },
      { id: 202, name: 'Old Thing', parentId: 200, level: 2, fullPath: 'EXPENSE : Bills : Old Thing', hidden: true, kind: 'expense' },
      { id: 210, name: 'Salary', parentId: 130, level: 1, fullPath: 'INCOME : Salary', hidden: false, kind: 'income' },
    ],
    payees: [
      { id: 50, name: 'BT', parentId: null, hidden: false },
      { id: 51, name: 'ACME LTD', parentId: null, hidden: false },
    ],
    transactions: [
      // standalone expense with payee + category
      { id: 1000, accountId: 1, date: '2020-05-01', amount: '-42.50', categoryId: 201, payeeId: 50, memo: 'line rental', ref: 'DD1', clearedStatus: 2, linkAccountId: null, role: 'standalone' },
      // standalone income (salary)
      { id: 1001, accountId: 1, date: '2020-05-25', amount: '2500.00', categoryId: 210, payeeId: 51, memo: null, ref: null, clearedStatus: 1, linkAccountId: null, role: 'standalone' },
      // transfer pair between acct 1 and acct 3
      { id: 1002, accountId: 1, date: '2020-06-01', amount: '-100.00', categoryId: null, payeeId: null, memo: 'pay card', ref: null, clearedStatus: 0, linkAccountId: 3, role: 'transfer', transferPairTxnId: 1003 },
      { id: 1003, accountId: 3, date: '2020-06-01', amount: '100.00', categoryId: null, payeeId: null, memo: 'pay card', ref: null, clearedStatus: 0, linkAccountId: 1, role: 'transfer', transferPairTxnId: 1002 },
      // balanced split: parent -100 = -70 + -30
      { id: 1010, accountId: 1, date: '2020-07-01', amount: '-100.00', categoryId: null, payeeId: 51, memo: null, ref: null, clearedStatus: 2, linkAccountId: null, role: 'splitParent' },
      { id: 1011, accountId: 1, date: '2020-07-01', amount: '-70.00', categoryId: 201, payeeId: null, memo: 'phone', ref: null, clearedStatus: 2, linkAccountId: null, role: 'splitChild', splitParentId: 1010 },
      { id: 1012, accountId: 1, date: '2020-07-01', amount: '-30.00', categoryId: 202, payeeId: null, memo: null, ref: null, clearedStatus: 2, linkAccountId: null, role: 'splitChild', splitParentId: 1010 },
      // partial split: parent -251.99 but child only covers -250.00
      { id: 1020, accountId: 1, date: '2020-08-01', amount: '-251.99', categoryId: null, payeeId: 51, memo: null, ref: null, clearedStatus: 2, linkAccountId: null, role: 'splitParent' },
      { id: 1021, accountId: 1, date: '2020-08-01', amount: '-250.00', categoryId: 201, payeeId: null, memo: null, ref: null, clearedStatus: 2, linkAccountId: null, role: 'splitChild', splitParentId: 1020 },
    ],
    ...over,
  };
}

describe('transformMsMoneyExport — accounts', () => {
  it('maps types, closed→inactive, and uses the reconstructed balance (never the dead stored one)', () => {
    const { accounts } = transformMsMoneyExport(build(), NOW);
    const hsbc = accounts.find(a => a.id === 'mny-acct-1')!;
    expect(hsbc.type).toBe('current');
    expect(hsbc.balance).toBe(150.5);
    expect(hsbc.isActive).toBe(true);

    const old = accounts.find(a => a.id === 'mny-acct-2')!;
    expect(old.isActive).toBe(false); // closed → inactive, never deleted

    const amex = accounts.find(a => a.id === 'mny-acct-3')!;
    expect(amex.type).toBe('credit');
    expect(amex.balance).toBe(-27368.77); // liability shows negative
  });
});

describe('transformMsMoneyExport — categories', () => {
  it('maps Money 3-level tree onto type/sub/detail with the system type parents', () => {
    const { categories } = transformMsMoneyExport(build(), NOW);
    expect(categories.find(c => c.id === 'type-income')?.level).toBe('type');

    const bills = categories.find(c => c.id === 'mny-cat-200')!;
    expect(bills.level).toBe('sub');
    expect(bills.parentId).toBe('type-expense');

    const phone = categories.find(c => c.id === 'mny-cat-201')!;
    expect(phone.level).toBe('detail');
    expect(phone.parentId).toBe('mny-cat-200');
    expect(phone.type).toBe('expense');
  });

  it('marks hidden Money categories inactive (kept, but out of the pickers)', () => {
    const { categories, summary } = transformMsMoneyExport(build(), NOW);
    expect(categories.find(c => c.id === 'mny-cat-202')?.isActive).toBe(false);
    expect(summary.categories.hidden).toBe(1);
  });
});

describe('transformMsMoneyExport — transactions', () => {
  it('maps standalone rows with payee as description, sign-derived type, reconciled→cleared', () => {
    const { transactions } = transformMsMoneyExport(build(), NOW);
    const t = transactions.find(x => x.id === 'mny-txn-1000')!;
    expect(t.description).toBe('BT');
    expect(t.amount).toBe(-42.5);
    expect(t.type).toBe('expense');
    expect(t.category).toBe('mny-cat-201');
    expect(t.cleared).toBe(true); // cs 2
    expect(t.notes).toBe('line rental'); // memo kept as notes (distinct payee)

    const inc = transactions.find(x => x.id === 'mny-txn-1001')!;
    expect(inc.type).toBe('income');
    expect(inc.cleared).toBe(false); // cs 1 is not reconciled
  });

  it('imports transfers as two linked transfer transactions filed under To/From categories', () => {
    const { transactions, categories } = transformMsMoneyExport(build(), NOW);
    const a = transactions.find(x => x.id === 'mny-txn-1002')!;
    const b = transactions.find(x => x.id === 'mny-txn-1003')!;
    expect(a.type).toBe('transfer');
    expect(a.transferAccountId).toBe('mny-acct-3');
    expect(a.linkedTransferId).toBe('mny-txn-1003');
    expect(b.transferAccountId).toBe('mny-acct-1');
    expect(b.linkedTransferId).toBe('mny-txn-1002');
    expect(a.amount + b.amount).toBe(0); // both legs net to zero

    // Each leg is filed under the OTHER account's "To/From <account>" category.
    expect(a.category).toBe('mny-tofrom-3');
    expect(b.category).toBe('mny-tofrom-1');
    const tf3 = categories.find(c => c.id === 'mny-tofrom-3')!;
    expect(tf3.isTransferCategory).toBe(true);
    expect(tf3.accountId).toBe('mny-acct-3');
    expect(tf3.parentId).toBe('type-transfer');
    expect(tf3.name).toBe('To/From Amex');
  });

  it('imports a balanced split as one split transaction whose lines sum to the total', () => {
    const { transactions, transactionSplits, summary } = transformMsMoneyExport(build(), NOW);
    const parent = transactions.find(x => x.id === 'mny-txn-1010')!;
    expect(parent.isSplit).toBe(true);
    expect(parent.category).toBe('');
    const lines = transactionSplits.filter(s => s.transactionId === 'mny-txn-1010');
    expect(lines).toHaveLength(2);
    expect(lines.reduce((s, l) => s + l.amount, 0)).toBe(parent.amount); // -100
    expect(lines.map(l => l.category)).toEqual(['mny-cat-201', 'mny-cat-202']);
    // the split children are NOT also emitted as standalone transactions
    expect(transactions.find(x => x.id === 'mny-txn-1011')).toBeUndefined();
    // build() has TWO split parents (1010 balanced + 1020 partial); 1010 → 2
    // lines, 1020 → 1 child + 1 Unassigned remainder = 4 lines total.
    expect(summary.transactions.splitTransactions).toBe(2);
    expect(summary.transactions.splitLines).toBe(4);
  });

  it('files an uncategorised split LINE under Unassigned — never blank, which the schema forbids', () => {
    // A split child Money left with no category at all. transaction_splits
    // requires a non-null, non-empty category, so a blank here is not merely
    // untidy — it is rejected by the database, and the whole import dies.
    const exp = build();
    exp.transactions.push(
      { id: 1030, accountId: 1, date: '2020-09-01', amount: '-50.00', categoryId: null, payeeId: 51, memo: null, ref: null, clearedStatus: 2, linkAccountId: null, role: 'splitParent' },
      { id: 1031, accountId: 1, date: '2020-09-01', amount: '-20.00', categoryId: 201, payeeId: null, memo: null, ref: null, clearedStatus: 2, linkAccountId: null, role: 'splitChild', splitParentId: 1030 },
      { id: 1032, accountId: 1, date: '2020-09-01', amount: '-30.00', categoryId: null, payeeId: null, memo: null, ref: null, clearedStatus: 2, linkAccountId: null, role: 'splitChild', splitParentId: 1030 },
    );

    const { transactionSplits } = transformMsMoneyExport(exp, NOW);
    const lines = transactionSplits.filter(s => s.transactionId === 'mny-txn-1030');

    expect(lines).toHaveLength(2);
    expect(lines.map(l => l.category)).toEqual(['mny-cat-201', 'mny-unassigned']);
    // No split line anywhere may be blank.
    expect(transactionSplits.filter(s => !String(s.category ?? '').trim())).toHaveLength(0);
    // The money still adds up — routing to Unassigned must not alter amounts.
    expect(lines.reduce((s, l) => s + l.amount, 0)).toBe(-50);
  });

  it('imports a PARTIAL split as a split whose lines (incl. an Unassigned remainder) sum to the exact total', () => {
    const { transactions, transactionSplits, categories } = transformMsMoneyExport(build(), NOW);
    const parent = transactions.find(x => x.id === 'mny-txn-1020')!;
    expect(parent.isSplit).toBe(true);
    expect(parent.amount).toBe(-251.99);
    const lines = transactionSplits.filter(s => s.transactionId === 'mny-txn-1020');
    // the recorded child (-250) + an Unassigned remainder (-1.99)
    expect(lines).toHaveLength(2);
    const remainder = lines.find(l => l.category === 'mny-unassigned')!;
    expect(remainder.amount).toBeCloseTo(-1.99, 2);
    expect(lines.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(-251.99, 2);
    // the Unassigned category exists
    expect(categories.find(c => c.id === 'mny-unassigned')?.level).toBe('detail');
    // the child is not also emitted as a standalone transaction
    expect(transactions.find(x => x.id === 'mny-txn-1021')).toBeUndefined();
  });

  it('corrects sign-flipped liability-account splits so the lines sum to the parent', () => {
    // Parent +200 in a liability account, children recorded as -120 + -80.
    const exp = build({
      transactions: [
        { id: 3000, accountId: 3, date: '2021-01-01', amount: '200.00', categoryId: null, payeeId: null, memo: null, ref: null, clearedStatus: 2, linkAccountId: null, role: 'splitParent' },
        { id: 3001, accountId: 3, date: '2021-01-01', amount: '-120.00', categoryId: 201, payeeId: null, memo: null, ref: null, clearedStatus: 2, linkAccountId: null, role: 'splitChild', splitParentId: 3000 },
        { id: 3002, accountId: 3, date: '2021-01-01', amount: '-80.00', categoryId: 201, payeeId: null, memo: null, ref: null, clearedStatus: 2, linkAccountId: null, role: 'splitChild', splitParentId: 3000 },
      ],
    });
    const { transactionSplits, summary } = transformMsMoneyExport(exp, NOW);
    const lines = transactionSplits.filter(s => s.transactionId === 'mny-txn-3000');
    expect(lines.map(l => l.amount)).toEqual([120, 80]); // signs flipped to match parent
    expect(lines.reduce((s, l) => s + l.amount, 0)).toBe(200);
    expect(summary.simplifications.some(s => /sign/.test(s))).toBe(true);
  });

  it('links a transfer whose partner is a split line BIDIRECTIONALLY (line ↔ counterpart)', () => {
    // A split in account 1 has a line that transfers to account 3; account 3's
    // counterpart leg (id 4001) points back at the split child (4000).
    const exp = build({
      transactions: [
        { id: 3500, accountId: 1, date: '2021-02-01', amount: '-100.00', categoryId: null, payeeId: null, memo: null, ref: null, clearedStatus: 2, linkAccountId: null, role: 'splitParent' },
        { id: 3501, accountId: 1, date: '2021-02-01', amount: '-70.00', categoryId: 201, payeeId: null, memo: null, ref: null, clearedStatus: 2, linkAccountId: null, role: 'splitChild', splitParentId: 3500 },
        { id: 4000, accountId: 1, date: '2021-02-01', amount: '-30.00', categoryId: null, payeeId: null, memo: null, ref: null, clearedStatus: 2, linkAccountId: 3, role: 'splitChild', splitParentId: 3500, isTransferLine: true, transferPairTxnId: 4001 },
        { id: 4001, accountId: 3, date: '2021-02-01', amount: '30.00', categoryId: null, payeeId: null, memo: null, ref: null, clearedStatus: 2, linkAccountId: 1, role: 'transfer', transferPairTxnId: 4000 },
      ],
    });
    const { transactions, transactionSplits, summary } = transformMsMoneyExport(exp, NOW);
    // the split's transfer line is categorised To/From account 3 AND carries
    // the leg fields pointing at the counterpart transaction
    const line = transactionSplits
      .filter(s => s.transactionId === 'mny-txn-3500')
      .find(l => l.amount === -30)!;
    expect(line.category).toBe('mny-tofrom-3');
    expect(line.transferAccountId).toBe('mny-acct-3');
    expect(line.linkedTransferId).toBe('mny-txn-4001');
    // a plain category line carries NO leg fields
    const plainLine = transactionSplits.find(s => s.id === 'mny-split-3500-1')!;
    expect(plainLine.linkedTransferId).toBeUndefined();
    // the counterpart leg links back: at the split PARENT, pinned to the line
    const counterpart = transactions.find(x => x.id === 'mny-txn-4001')!;
    expect(counterpart.type).toBe('transfer');
    expect(counterpart.category).toBe('mny-tofrom-1');
    expect(counterpart.linkedTransferId).toBe('mny-txn-3500');
    expect(counterpart.linkedTransferSplitId).toBe(line.id);
    // the split child is not also emitted as its own transaction
    expect(transactions.find(x => x.id === 'mny-txn-4000')).toBeUndefined();
    expect(summary.simplifications.some(s => /fully linked/.test(s))).toBe(true);
  });

  it('per-account reconstructed balance equals opening + Σ(its imported non-split-child amounts)', () => {
    // The app's ledger invariant. Sum every imported transaction for account 1
    // (standalone + transfer leg + split parent totals) and check it matches
    // the account's reconstructed balance the extractor computed.
    const exp = build();
    const { accounts, transactions } = transformMsMoneyExport(exp, NOW);
    const acct1 = accounts.find(a => a.id === 'mny-acct-1')!;
    const sum = transactions
      .filter(t => t.accountId === 'mny-acct-1')
      .reduce((s, t) => s + t.amount, 0);
    const computed = (acct1.openingBalance ?? 0) + sum;
    // -42.50 + 2500 - 100 (transfer out) - 100 (split) - 251.99 (partial) = 2005.51
    expect(computed).toBeCloseTo(2005.51, 2);
  });
});

describe('transformMsMoneyExport — no-duplication invariants', () => {
  // These lock the properties a duplicated-rows investigation (2026-07-22)
  // checked the transform against. Money stores one transfer as TWO TRN rows,
  // one in each account; the failure mode worth guarding is either leg landing
  // in the same account twice, or any source row being emitted more than once.

  it('emits exactly one transaction per source row and never repeats an id', () => {
    const exp = build();
    const { transactions } = transformMsMoneyExport(exp, NOW);
    const emitted = exp.transactions.filter(t => t.role !== 'splitChild');
    expect(transactions).toHaveLength(emitted.length);
    expect(new Set(transactions.map(t => t.id)).size).toBe(transactions.length);
    // Every emitted id traces back to exactly one Money htrn.
    expect(transactions.map(t => t.id).sort()).toEqual(emitted.map(t => `mny-txn-${t.id}`).sort());
  });

  it('puts the two legs of a transfer in DIFFERENT accounts — never both in one', () => {
    const { transactions } = transformMsMoneyExport(build(), NOW);
    const byId = new Map(transactions.map(t => [t.id, t]));
    const legs = transactions.filter(t => t.type === 'transfer');
    expect(legs.length).toBeGreaterThan(0);
    for (const leg of legs) {
      const partner = byId.get(leg.linkedTransferId as string)!;
      expect(partner).toBeDefined();
      // Same-account pairing would double-count the transfer inside one ledger.
      expect(partner.accountId).not.toBe(leg.accountId);
      // A leg never points at its own account either.
      expect(leg.transferAccountId).not.toBe(leg.accountId);
      expect(partner.linkedTransferId).toBe(leg.id);
    }
  });

  it('keeps two genuinely identical Money rows as two transactions', () => {
    // Money's TRN can legitimately hold repeated same-day charges (subscription
    // batches, standing orders). They share account/date/amount/payee and differ
    // only by htrn — collapsing them would silently delete real money.
    const exp = build({
      transactions: [
        { id: 5000, accountId: 1, date: '2021-03-01', amount: '-7.99', categoryId: 201, payeeId: 50, memo: null, ref: null, clearedStatus: 2, linkAccountId: null, role: 'standalone' },
        { id: 5001, accountId: 1, date: '2021-03-01', amount: '-7.99', categoryId: 201, payeeId: 50, memo: null, ref: null, clearedStatus: 2, linkAccountId: null, role: 'standalone' },
      ],
    });
    const { transactions } = transformMsMoneyExport(exp, NOW);
    expect(transactions).toHaveLength(2);
    expect(transactions.map(t => t.id)).toEqual(['mny-txn-5000', 'mny-txn-5001']);
    expect(transactions.reduce((s, t) => s + t.amount, 0)).toBeCloseTo(-15.98, 2);
  });

  it('keeps two identical transfers as two independent, correctly-paired legs', () => {
    // Two same-day transfers of the same amount between the same accounts:
    // four TRN rows, two pairs. Each leg must pair with its OWN partner.
    const exp = build({
      transactions: [
        { id: 6000, accountId: 1, date: '2021-04-01', amount: '-250.00', categoryId: null, payeeId: null, memo: null, ref: null, clearedStatus: 0, linkAccountId: 3, role: 'transfer', transferPairTxnId: 6002 },
        { id: 6001, accountId: 1, date: '2021-04-01', amount: '-250.00', categoryId: null, payeeId: null, memo: null, ref: null, clearedStatus: 0, linkAccountId: 3, role: 'transfer', transferPairTxnId: 6003 },
        { id: 6002, accountId: 3, date: '2021-04-01', amount: '250.00', categoryId: null, payeeId: null, memo: null, ref: null, clearedStatus: 0, linkAccountId: 1, role: 'transfer', transferPairTxnId: 6000 },
        { id: 6003, accountId: 3, date: '2021-04-01', amount: '250.00', categoryId: null, payeeId: null, memo: null, ref: null, clearedStatus: 0, linkAccountId: 1, role: 'transfer', transferPairTxnId: 6001 },
      ],
    });
    const { transactions } = transformMsMoneyExport(exp, NOW);
    expect(transactions).toHaveLength(4);
    // Two legs per account, not four in one.
    expect(transactions.filter(t => t.accountId === 'mny-acct-1')).toHaveLength(2);
    expect(transactions.filter(t => t.accountId === 'mny-acct-3')).toHaveLength(2);
    expect(transactions.find(t => t.id === 'mny-txn-6000')!.linkedTransferId).toBe('mny-txn-6002');
    expect(transactions.find(t => t.id === 'mny-txn-6001')!.linkedTransferId).toBe('mny-txn-6003');
    // Both accounts net to zero against each other.
    expect(transactions.reduce((s, t) => s + t.amount, 0)).toBe(0);
  });
});

describe('transformMsMoneyExport — investment cash pairing (hacctRel)', () => {
  const invAccounts = [
    { id: 10, name: 'Rathbones - Share ISA', moneyType: 'investment', relatedAccountId: 11, currencyCode: 'GBP', openingBalance: '0', reconstructedBalance: '0', closed: false, openDate: null, closeDate: null, comment: null },
    { id: 11, name: 'Rathbones - Share ISA (Cash)', moneyType: 'bank', relatedAccountId: 10, currencyCode: 'GBP', openingBalance: '0', reconstructedBalance: '250.00', closed: false, openDate: null, closeDate: null, comment: null },
    // hacctRel between two NON-investment accounts (never seen in practice) —
    // left unpaired rather than guessed at
    { id: 12, name: 'Bank A', moneyType: 'bank', relatedAccountId: 13, currencyCode: 'GBP', openingBalance: '0', reconstructedBalance: '0', closed: false, openDate: null, closeDate: null, comment: null },
    { id: 13, name: 'Bank B', moneyType: 'bank', relatedAccountId: 12, currencyCode: 'GBP', openingBalance: '0', reconstructedBalance: '0', closed: false, openDate: null, closeDate: null, comment: null },
  ];

  it('nests the cash side under its investment account; the investment side stays top-level', () => {
    const { accounts, summary } = transformMsMoneyExport(build({ accounts: invAccounts, transactions: [] }), NOW);
    expect(accounts.find(a => a.id === 'mny-acct-11')!.parentAccountId).toBe('mny-acct-10');
    expect(accounts.find(a => a.id === 'mny-acct-10')!.parentAccountId).toBeUndefined();
    expect(summary.accounts.investmentCashPairs).toBe(1);
  });

  it('ignores hacctRel links that are not investment↔cash', () => {
    const { accounts } = transformMsMoneyExport(build({ accounts: invAccounts, transactions: [] }), NOW);
    expect(accounts.find(a => a.id === 'mny-acct-12')!.parentAccountId).toBeUndefined();
    expect(accounts.find(a => a.id === 'mny-acct-13')!.parentAccountId).toBeUndefined();
  });

  it('accounts without hacctRel are unaffected', () => {
    const { accounts, summary } = transformMsMoneyExport(build(), NOW);
    expect(accounts.every(a => a.parentAccountId === undefined)).toBe(true);
    expect(summary.accounts.investmentCashPairs).toBe(0);
  });
});
