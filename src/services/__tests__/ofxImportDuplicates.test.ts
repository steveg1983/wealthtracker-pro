/**
 * Re-importing a statement over a period you already have.
 *
 * An OFX file covering days already in the register added every one of its
 * transactions a second time. It hid because the account is on a nightly sweep
 * back to zero, so the duplicated payment and its duplicated sweep cancelled
 * out: the balance stayed correct while the register showed everything twice.
 * A balance check would not have found it, and did not.
 *
 * The fixtures below are invented, but they keep the shape that matters: the
 * same money on the same day, described differently on the two sides.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ofxImportService } from '../ofxImportService';
import { smartCategorizationService } from '../smartCategorizationService';
import type { Account, Category, Transaction } from '../../types';

const ACCOUNT_ID = 'acc-current';

const accounts: Account[] = [
  {
    id: ACCOUNT_ID,
    name: 'Everyday Current',
    type: 'current',
    balance: 0,
    currency: 'GBP',
    lastUpdated: new Date('2027-02-28')
  }
];

/** One <STMTTRN>, written the way a UK bank's export writes them. */
const stmtTrn = (
  fitId: string,
  day: string,
  amount: string,
  name: string,
  type: string = amount.startsWith('-') ? 'DEBIT' : 'CREDIT'
): string => `<STMTTRN>
<TRNTYPE>${type}
<DTPOSTED>${day}120000[0:GMT]
<TRNAMT>${amount}
<FITID>${fitId}
<NAME>${name}
</STMTTRN>`;

const ofxFile = (transactions: string[]): string => `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>GBP
<BANKACCTFROM>
<BANKID>123456
<ACCTID>12345678
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20270201000000[0:GMT]
<DTEND>20270228235959[0:GMT]
${transactions.join('\n')}
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>0.00
<DTASOF>20270228235959[0:GMT]
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

/**
 * Left column is what the register already held — truncated by whatever
 * imported it, or renamed by hand ("Nadia"). Right column is what the same
 * transaction is called in the OFX file.
 */
const PAIRS = [
  { fitId: '20270207001', day: '20270207', amount: '9876.54', held: 'Sweep Transfer from account 5566', file: 'Sweep Transfer from account 55667788' },
  { fitId: '20270207002', day: '20270207', amount: '-63.20', held: 'Direct Debit - STREAMCO', file: 'Direct Debit - STREAMCO  00110022330044' },
  { fitId: '20270207003', day: '20270207', amount: '-2500.00', held: 'SAMPLE PERSON A', file: 'Standing Order to MISS A SAMPLE - A SAMPLE' },
  { fitId: '20270207004', day: '20270207', amount: '-410.00', held: 'Nadia', file: 'Immediate Faster Payment (Online) to B EXAMPLE 07-FEB-2027' },
  { fitId: '20270207005', day: '20270207', amount: '-77.45', held: 'Direct Debit - TELCO LTD  447', file: 'Direct Debit - TELCO LTD  447221900-00007' }
];

const STATEMENT = ofxFile(PAIRS.map(pair => stmtTrn(pair.fitId, pair.day, pair.amount, pair.file)));

/** The register as it stood before the re-import: every row already there. */
const alreadyHeld: Transaction[] = PAIRS.map((pair, index) => ({
  id: `held-${index}`,
  date: new Date('2027-02-07'),
  description: pair.held,
  amount: Number(pair.amount),
  type: pair.amount.startsWith('-') ? 'expense' : 'income',
  accountId: ACCOUNT_ID,
  category: 'general',
  // Every pre-existing row was reconciled; every newly imported one was not.
  cleared: true
}));

describe('OFX re-import of a period already held', () => {
  it('recognises every row despite truncated and renamed descriptions', async () => {
    const result = await ofxImportService.importTransactions(STATEMENT, accounts, alreadyHeld, {
      accountId: ACCOUNT_ID
    });

    expect(result.duplicateMatches.possible).toHaveLength(5);
    expect(result.duplicates).toBe(5);
    expect(result.transactions).toHaveLength(0);
    expect(result.newTransactions).toBe(0);

    // Each one paired with the right held row, not merely "something".
    expect(result.duplicateMatches.possible.map(match => match.heldDescription)).toEqual(
      PAIRS.map(pair => pair.held)
    );
  });

  it('offers them for review rather than deciding alone', async () => {
    const result = await ofxImportService.importTransactions(STATEMENT, accounts, alreadyHeld, {
      accountId: ACCOUNT_ID
    });

    // Nothing here is proof — the bank's own id is on one side only — so every
    // match is reviewable, carries both descriptions and says how far apart the
    // two dates are. That is what the preview list is built from.
    expect(result.duplicateMatches.certain).toHaveLength(0);
    expect(result.duplicateMatches.possible).toHaveLength(5);
    for (const match of result.duplicateMatches.possible) {
      expect(match.basis).toBe('amount-and-date');
      expect(match.dayGap).toBe(0);
      expect(match.heldCleared).toBe(true);
      expect(match.fitId).not.toBeNull();
    }
  });

  it('imports the ones the user overrules, and only those', async () => {
    const result = await ofxImportService.importTransactions(STATEMENT, accounts, alreadyHeld, {
      accountId: ACCOUNT_ID,
      importAnywayFitIds: ['20270207004']
    });

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe(
      'Immediate Faster Payment (Online) to B EXAMPLE 07-FEB-2027'
    );
    expect(result.duplicates).toBe(4);
  });

  it('imports nothing twice when the user turns the check off — but says what it saw', async () => {
    const result = await ofxImportService.importTransactions(STATEMENT, accounts, alreadyHeld, {
      accountId: ACCOUNT_ID,
      skipDuplicates: false
    });

    expect(result.transactions).toHaveLength(5);
    expect(result.duplicates).toBe(0);
    // Turning the check off decides what to DO, not what is true: the caller
    // still gets the finding, so the screen can still say it.
    expect(result.duplicateMatches.possible).toHaveLength(5);
  });

  it('adds a second, genuinely separate payment of the same amount on the same day', async () => {
    // Two £20 withdrawals on one day. The register holds one; the statement
    // carries both. Dropping both would lose real spending.
    const file = ofxFile([
      stmtTrn('20270210001', '20270210', '-20.00', 'CASH ATM HIGH ST'),
      stmtTrn('20270210002', '20270210', '-20.00', 'CASH ATM HIGH ST')
    ]);
    const register: Transaction[] = [{
      id: 'one-withdrawal',
      date: new Date('2027-02-10'),
      description: 'Cash',
      amount: -20,
      type: 'expense',
      accountId: ACCOUNT_ID,
      category: 'general',
      cleared: true
    }];

    const result = await ofxImportService.importTransactions(file, accounts, register, {
      accountId: ACCOUNT_ID
    });

    expect(result.duplicateMatches.possible).toHaveLength(1);
    expect(result.transactions).toHaveLength(1);
  });

  it('will not let an override undo a FITID match', async () => {
    // The bank saying "this is the same transaction" is not a judgement call,
    // and the review list never shows these — so an id arriving here could only
    // be stale, and acting on it would re-import a proven duplicate.
    const file = ofxFile([stmtTrn('20270207002', '20270207', '-63.20', 'Direct Debit - STREAMCO  00110022330044')]);
    const register: Transaction[] = [{
      id: 'streamco',
      date: new Date('2027-02-07'),
      description: 'Streamco',
      amount: -63.2,
      type: 'expense',
      accountId: ACCOUNT_ID,
      category: 'general',
      cleared: true,
      notes: 'FITID: 20270207002'
    }];

    const result = await ofxImportService.importTransactions(file, accounts, register, {
      accountId: ACCOUNT_ID,
      importAnywayFitIds: ['20270207002']
    });

    expect(result.duplicateMatches.certain).toHaveLength(1);
    expect(result.transactions).toHaveLength(0);
  });

  it('compares the destination account only', async () => {
    const elsewhere: Transaction[] = alreadyHeld.map(row => ({ ...row, accountId: 'acc-savings' }));

    const result = await ofxImportService.importTransactions(STATEMENT, accounts, elsewhere, {
      accountId: ACCOUNT_ID
    });

    expect(result.duplicateMatches.possible).toHaveLength(0);
    expect(result.transactions).toHaveLength(5);
  });
});

describe('OFX auto-categorisation', () => {
  const categories: Category[] = [
    { id: 'tofrom-current', name: 'To/From Everyday Current', type: 'both', level: 'detail', isTransferCategory: true, accountId: ACCOUNT_ID },
    { id: 'tofrom-savings', name: 'To/From Savings', type: 'both', level: 'detail', isTransferCategory: true, accountId: 'acc-savings' },
    { id: 'groceries', name: 'Groceries', type: 'expense', level: 'detail' }
  ];

  /**
   * What the account's own history looks like: the nightly sweep is a real
   * transfer, correctly filed under the account's own To/From category. Its
   * description begins with the same three words as every other faster payment
   * on the statement — which is exactly the key the categoriser learns.
   */
  const sweepHistory: Transaction[] = Array.from({ length: 6 }, (_, index) => ({
    id: `sweep-${index}`,
    date: new Date(2027, 0, index + 1),
    description: `Immediate Faster Payment (Online) to OWN SAVINGS 0${index}-JAN-2027`,
    amount: -500,
    type: 'transfer',
    accountId: ACCOUNT_ID,
    category: 'tofrom-current',
    cleared: true
  }));

  beforeEach(() => {
    smartCategorizationService.learnFromTransactions(sweepHistory, categories);
  });

  it('never files a payment as a transfer to the account it is already in', async () => {
    const file = ofxFile([
      stmtTrn('20270207004', '20270207', '-410.00', 'Immediate Faster Payment (Online) to B EXAMPLE 07-FEB-2027')
    ]);

    // The suggestion the guard exists to refuse is real, and confident enough
    // to have been applied: this is the machinery that filed ordinary
    // third-party payments as transfers to the payer's own account.
    const suggestion = smartCategorizationService.suggestCategories({
      id: 'draft',
      date: new Date('2027-02-07'),
      description: 'Immediate Faster Payment (Online) to B EXAMPLE 07-FEB-2027',
      amount: -410,
      type: 'expense',
      accountId: ACCOUNT_ID,
      category: ''
    }, 1);
    expect(suggestion[0].categoryId).toBe('tofrom-current');
    expect(suggestion[0].confidence).toBeGreaterThanOrEqual(0.7);

    const result = await ofxImportService.importTransactions(file, accounts, sweepHistory, {
      accountId: ACCOUNT_ID,
      categories,
      autoCategorize: true
    });

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].category).toBe('');
  });

  it('still applies a suggestion that means something', async () => {
    const groceryHistory: Transaction[] = Array.from({ length: 4 }, (_, index) => ({
      id: `shop-${index}`,
      date: new Date(2027, 0, index + 1),
      description: 'CARD PURCHASE MARKET STORES',
      amount: -40,
      type: 'expense',
      accountId: ACCOUNT_ID,
      category: 'groceries',
      cleared: true
    }));
    const file = ofxFile([stmtTrn('20270208001', '20270208', '-38.20', 'CARD PURCHASE MARKET STORES')]);

    const result = await ofxImportService.importTransactions(file, accounts, groceryHistory, {
      accountId: ACCOUNT_ID,
      categories,
      autoCategorize: true
    });

    expect(result.transactions[0].category).toBe('groceries');
  });

  it('leaves the OTHER account\'s transfer category alone', async () => {
    // Only "a transfer to the account this row is already in" is meaningless.
    // A genuine transfer out to Savings is exactly what a To/From category is
    // for, and the guard must not reach it.
    const savingsHistory: Transaction[] = Array.from({ length: 4 }, (_, index) => ({
      id: `to-savings-${index}`,
      date: new Date(2027, 0, index + 1),
      description: 'STANDING ORDER SAVINGS POT',
      amount: -250,
      type: 'transfer',
      accountId: ACCOUNT_ID,
      category: 'tofrom-savings',
      cleared: true
    }));
    const file = ofxFile([stmtTrn('20270209001', '20270209', '-250.00', 'STANDING ORDER SAVINGS POT')]);

    const result = await ofxImportService.importTransactions(file, accounts, savingsHistory, {
      accountId: ACCOUNT_ID,
      categories,
      autoCategorize: true
    });

    expect(result.transactions[0].category).toBe('tofrom-savings');
  });
});
