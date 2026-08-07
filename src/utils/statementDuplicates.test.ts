import { describe, it, expect } from 'vitest';
import {
  descriptionSimilarity,
  findStatementDuplicates,
  readFitId,
  type HeldTransactionRow,
  type IncomingStatementRow
} from './statementDuplicates';

const ACCOUNT = 'current-account';
const OTHER_ACCOUNT = 'savings';

const held = (overrides: Partial<HeldTransactionRow> & Pick<HeldTransactionRow, 'id' | 'amount'>): HeldTransactionRow => ({
  accountId: ACCOUNT,
  date: '2027-02-07',
  description: '',
  ...overrides
});

const incoming = (
  overrides: Partial<IncomingStatementRow> & Pick<IncomingStatementRow, 'amount'>
): IncomingStatementRow => ({
  date: '2027-02-07',
  description: '',
  fitId: null,
  ...overrides
});

/**
 * The five shapes a re-imported statement produced in production, with invented
 * names and figures. Every row is the same transaction on both sides, and not
 * one has the same description twice: three were truncated by whatever imported
 * them, one is written by a different system entirely, and one was renamed by
 * hand to something the user would recognise later.
 */
const PAIR_SHAPES = [
  {
    heldDescription: 'Sweep Transfer from account 5566',
    fileDescription: 'Sweep Transfer from account 55667788',
    amount: 9876.54
  },
  {
    heldDescription: 'Direct Debit - STREAMCO',
    fileDescription: 'Direct Debit - STREAMCO  00110022330044',
    amount: -63.2
  },
  {
    heldDescription: 'SAMPLE PERSON A',
    fileDescription: 'Standing Order to MISS A SAMPLE - A SAMPLE',
    amount: -2500
  },
  {
    heldDescription: 'Nadia',
    fileDescription: 'Immediate Faster Payment (Online) to B EXAMPLE 07-FEB-2027',
    amount: -410
  },
  {
    heldDescription: 'Direct Debit - TELCO LTD  447',
    fileDescription: 'Direct Debit - TELCO LTD  447221900-00007',
    amount: -77.45
  }
];

describe('readFitId', () => {
  it('reads the id the OFX importer writes, and only a whole one', () => {
    expect(readFitId('FITID: 2026060401\nCheck #: 1234')).toBe('2026060401');
    expect(readFitId('Ref: 99\nFITID: ABC-123')).toBe('ABC-123');
    // Anchored: a longer id must not answer to a shorter query, or every
    // transaction in a bank's sequential range would match its neighbours.
    expect(readFitId('FITID: 12345')).not.toBe('1234');
    expect(readFitId('paid the FITID: 7 invoice')).toBeNull();
    expect(readFitId(undefined)).toBeNull();
    expect(readFitId('')).toBeNull();
  });
});

describe('findStatementDuplicates', () => {
  it('sees through truncated and user-edited descriptions', () => {
    // THE BUG. Every one of these was imported a second time because the only
    // test was "does the held row's notes contain this FITID", and rows that
    // came from anywhere but this importer carry no FITID at all.
    const heldRows = PAIR_SHAPES.map((pair, index) =>
      held({ id: `held-${index}`, amount: pair.amount, description: pair.heldDescription, cleared: true })
    );
    const fileRows = PAIR_SHAPES.map((pair, index) =>
      incoming({ amount: pair.amount, description: pair.fileDescription, fitId: `fit-${index}` })
    );

    const result = findStatementDuplicates(fileRows, heldRows, ACCOUNT);

    expect(result.certain).toHaveLength(0);
    expect(result.possible.map(match => match.incomingIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(result.possible.map(match => match.heldId)).toEqual([
      'held-0', 'held-1', 'held-2', 'held-3', 'held-4'
    ]);
  });

  it('matches a payee the user renamed, which shares not one word with the bank\'s wording', () => {
    // "Nadia" vs "Immediate Faster Payment (Online) to B EXAMPLE": nothing
    // in common. Any rule that required the descriptions to agree — or merely
    // to be similar — would have missed this and doubled the payment.
    expect(descriptionSimilarity('Nadia', 'Immediate Faster Payment (Online) to B EXAMPLE 07-FEB-2027')).toBe(0);

    const result = findStatementDuplicates(
      [incoming({ amount: -410, description: 'Immediate Faster Payment (Online) to B EXAMPLE 07-FEB-2027', fitId: 'fit-1' })],
      [held({ id: 'renamed', amount: -410, description: 'Nadia', cleared: true })],
      ACCOUNT
    );

    expect(result.possible).toHaveLength(1);
    expect(result.possible[0].heldDescription).toBe('Nadia');
    expect(result.possible[0].descriptionSimilarity).toBe(0);
    expect(result.possible[0].heldCleared).toBe(true);
  });

  it('flags only as many rows as the register could actually account for', () => {
    // Two £20 cash withdrawals on one day is a real thing. The register holds
    // ONE; the file carries TWO. Exactly one is a duplicate, and dropping both
    // would lose real spending.
    const result = findStatementDuplicates(
      [
        incoming({ amount: -20, description: 'CASH ATM HIGH ST', fitId: 'fit-1' }),
        incoming({ amount: -20, description: 'CASH ATM HIGH ST', fitId: 'fit-2' })
      ],
      [held({ id: 'withdrawal', amount: -20, description: 'Cash' })],
      ACCOUNT
    );

    expect(result.possible).toHaveLength(1);
    expect(result.possible[0].incomingIndex).toBe(0);
  });

  it('never pairs a row with a transaction in a different account', () => {
    const result = findStatementDuplicates(
      [incoming({ amount: -77.45, description: 'Direct Debit - TELCO LTD  447221900-00007', fitId: 'fit-1' })],
      [held({ id: 'elsewhere', accountId: OTHER_ACCOUNT, amount: -77.45, description: 'Direct Debit - TELCO LTD  447' })],
      ACCOUNT
    );

    expect(result.possible).toHaveLength(0);
  });

  it('compares amounts as exact pence, not as floats', () => {
    // 0.1 + 0.2 is 0.30000000000000004: `===` says these are different
    // transactions, Decimal says they are the same 30p.
    const same = findStatementDuplicates(
      [incoming({ amount: -(0.1 + 0.2), description: 'Card fee', fitId: 'fit-1' })],
      [held({ id: 'fee', amount: -0.3, description: 'Fee' })],
      ACCOUNT
    );
    expect(same.possible).toHaveLength(1);

    // And a penny apart is a different transaction, however close it looks.
    const apart = findStatementDuplicates(
      [incoming({ amount: -77.46, description: 'Direct Debit - TELCO LTD  447221900-00007', fitId: 'fit-1' })],
      [held({ id: 'telco', amount: -77.45, description: 'Direct Debit - TELCO LTD  447' })],
      ACCOUNT
    );
    expect(apart.possible).toHaveLength(0);
  });

  it('allows the settlement-date gap, and stops', () => {
    const fileRow = incoming({ date: '2027-02-07', amount: -63.2, description: 'Direct Debit - STREAMCO  00110022330044', fitId: 'fit-1' });

    const withinWindow = findStatementDuplicates(
      [fileRow],
      [held({ id: 'streamco', date: '2027-02-10', amount: -63.2, description: 'Direct Debit - STREAMCO' })],
      ACCOUNT
    );
    expect(withinWindow.possible).toHaveLength(1);
    expect(withinWindow.possible[0].dayGap).toBe(3);

    const outsideWindow = findStatementDuplicates(
      [fileRow],
      [held({ id: 'streamco', date: '2027-02-11', amount: -63.2, description: 'Direct Debit - STREAMCO' })],
      ACCOUNT
    );
    expect(outsideWindow.possible).toHaveLength(0);
  });

  it('prefers the nearest date, and lets the description break a tie', () => {
    const result = findStatementDuplicates(
      [incoming({ date: '2027-02-07', amount: -50, description: 'CARD PAYMENT TO WAITROSE', fitId: 'fit-1' })],
      [
        held({ id: 'far', date: '2027-02-09', amount: -50, description: 'Waitrose' }),
        held({ id: 'near-wrong-words', date: '2027-02-08', amount: -50, description: 'Petrol' }),
        held({ id: 'near-right-words', date: '2027-02-08', amount: -50, description: 'Waitrose' })
      ],
      ACCOUNT
    );

    expect(result.possible).toHaveLength(1);
    expect(result.possible[0].heldId).toBe('near-right-words');
  });

  it('reports a FITID pair as proof, and does not offer it for review', () => {
    const result = findStatementDuplicates(
      [incoming({ amount: -63.2, description: 'Direct Debit - STREAMCO  00110022330044', fitId: '2026060401' })],
      [held({ id: 'streamco', amount: -63.2, description: 'Sky', notes: 'FITID: 2026060401' })],
      ACCOUNT
    );

    expect(result.certain).toHaveLength(1);
    expect(result.certain[0].basis).toBe('fitid');
    expect(result.possible).toHaveLength(0);
  });

  it('lets the FITID pair claim its row before the weaker rule can take it', () => {
    // Both held rows are -£20 on the day, so the amount rule would happily
    // pair either one. The row the bank names must not be stolen from it.
    const result = findStatementDuplicates(
      [
        incoming({ amount: -20, description: 'CASH', fitId: 'known' }),
        incoming({ amount: -20, description: 'CASH', fitId: 'unknown' })
      ],
      [
        held({ id: 'plain', amount: -20, description: 'Cash' }),
        held({ id: 'identified', amount: -20, description: 'Cash', notes: 'FITID: known' })
      ],
      ACCOUNT
    );

    expect(result.certain.map(match => match.heldId)).toEqual(['identified']);
    expect(result.possible.map(match => match.heldId)).toEqual(['plain']);
  });

  it('treats a row with an unreadable date as a duplicate of nothing', () => {
    const unreadable = findStatementDuplicates(
      [incoming({ date: 'not a date', amount: -20, description: 'Cash', fitId: 'fit-1' })],
      [held({ id: 'held', amount: -20, description: 'Cash' })],
      ACCOUNT
    );
    expect(unreadable.possible).toHaveLength(0);

    const heldUnreadable = findStatementDuplicates(
      [incoming({ amount: -20, description: 'Cash', fitId: 'fit-1' })],
      [held({ id: 'held', date: 'not a date', amount: -20, description: 'Cash' })],
      ACCOUNT
    );
    expect(heldUnreadable.possible).toHaveLength(0);
  });

  it('has nothing to compare against without a destination account', () => {
    const result = findStatementDuplicates(
      [incoming({ amount: -20, description: 'Cash', fitId: 'fit-1' })],
      [held({ id: 'held', amount: -20, description: 'Cash' })],
      ''
    );
    expect(result.certain).toHaveLength(0);
    expect(result.possible).toHaveLength(0);
  });
});
