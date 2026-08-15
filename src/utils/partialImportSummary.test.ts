import { describe, it, expect } from 'vitest';
import { summariseMissingRows, type MissingRow } from './partialImportSummary';

/** Invented rows, in the shape a statement produces. */
const row = (date: string, description: string, amount: number): MissingRow => ({
  date: new Date(date),
  description,
  amount
});

describe('summariseMissingRows', () => {
  it('names each missing payment by date, payee and amount', () => {
    // Enough for someone holding the statement to find the line. A count alone
    // cannot be acted on at all.
    const summary = summariseMissingRows(
      [row('2024-02-05', 'DIRECT DEBIT THAMES WATER', -12.75)],
      'GBP'
    );

    expect(summary.count).toBe(1);
    expect(summary.named).toEqual(['05/02/2024 · DIRECT DEBIT THAMES WATER · (£12.75)']);
    expect(summary.hidden).toBe(0);
  });

  it('uses the destination account currency, not a default', () => {
    // Naming a dollar payment in pounds makes it unfindable on the statement.
    const summary = summariseMissingRows([row('2024-02-05', 'AMAZON MKTPLACE', -19.99)], 'USD');

    expect(summary.named[0]).toContain('($19.99)');
  });

  it('caps the list and says how many more there are', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      row(`2024-02-${String(i + 10).padStart(2, '0')}`, `PAYMENT ${i}`, -1)
    );

    const summary = summariseMissingRows(many, 'GBP', 3);

    expect(summary.count).toBe(9);
    expect(summary.named).toHaveLength(3);
    expect(summary.hidden).toBe(6);
  });

  it('reports the EARLIEST missing day, not the first row in file order', () => {
    // A re-import has to start from the oldest missing day, and a statement is
    // not always listed oldest-first.
    const summary = summariseMissingRows(
      [
        row('2024-03-20', 'LATER PAYMENT', -5),
        row('2024-02-11', 'EARLIER PAYMENT', -5)
      ],
      'GBP',
      1
    );

    expect(summary.earliestDate).toBe('11/02/2024');
  });

  it('says nothing at all when nothing is missing', () => {
    expect(summariseMissingRows([], 'GBP')).toEqual({
      count: 0,
      named: [],
      hidden: 0,
      earliestDate: ''
    });
  });

  it('reads a string date, because storage hands dates back as JSON', () => {
    const summary = summariseMissingRows(
      [{ date: '2024-02-05T00:00:00.000Z', description: 'CARD PAYMENT', amount: -8.4 }],
      'GBP'
    );

    expect(summary.named[0]).toContain('05/02/2024');
  });
});
