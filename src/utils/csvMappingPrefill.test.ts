import { describe, it, expect } from 'vitest';
import { applyMappingPrefill } from './csvMappingPrefill';
import type { ColumnMapping } from '../services/enhancedCsvImportService';

/**
 * A template and a saved profile are the same thing — column names written down
 * against SOME file — and this is the one rule that applies either to THIS one.
 * Everything it drops, it names: a mapping silently discarded is what made a
 * bank template feel like a button that did nothing.
 */
describe('applying saved column names to a real file', () => {
  const headers = ['Date', 'Description', 'Paid out', 'Paid in', 'Balance'];

  it('keeps the mappings whose columns are here', () => {
    const saved: ColumnMapping[] = [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Paid out', targetField: 'amount' }
    ];

    const outcome = applyMappingPrefill(saved, headers);

    expect(outcome.applied).toEqual(saved);
    expect(outcome.notInFile).toEqual([]);
    expect(outcome.notImported).toEqual([]);
  });

  it('names the columns this file has not got instead of dropping them', () => {
    const outcome = applyMappingPrefill(
      [
        { sourceColumn: 'Transaction Date', targetField: 'date' },
        { sourceColumn: 'Narrative', targetField: 'description' },
        { sourceColumn: 'Paid out', targetField: 'amount' }
      ],
      headers
    );

    expect(outcome.applied.map(mapping => mapping.sourceColumn)).toEqual(['Paid out']);
    expect(outcome.notInFile).toEqual(['Transaction Date', 'Narrative']);
  });

  /**
   * A running balance, a share price, a quantity: real columns in real exports
   * with nowhere to go on a transaction. They used to be applied as though they
   * meant something — a row in the mapping list, a dropdown with a value, and
   * nothing written at the end of it.
   */
  it('separates "not in your file" from "this app does not import that"', () => {
    const outcome = applyMappingPrefill(
      [
        { sourceColumn: 'Date', targetField: 'date' },
        { sourceColumn: 'Balance', targetField: 'balance' },
        { sourceColumn: 'Share Price', targetField: 'price' },
        { sourceColumn: 'Narrative', targetField: 'description' }
      ],
      headers
    );

    expect(outcome.applied.map(mapping => mapping.sourceColumn)).toEqual(['Date']);
    // 'Balance' IS in the file — it is the destination that does not exist, and
    // saying "not found in your file" about a column the user can see would be
    // the more confusing lie of the two.
    expect(outcome.notImported).toEqual(['Balance', 'Share Price']);
    expect(outcome.notInFile).toEqual(['Narrative']);
  });

  /**
   * Banks are not consistent with themselves between months. Refusing on a
   * capital letter is a distinction no user can act on.
   */
  it('matches a column whose only difference is case or spacing', () => {
    const outcome = applyMappingPrefill(
      [
        { sourceColumn: 'paid out', targetField: 'amount' },
        { sourceColumn: '  Paid  In  ', targetField: 'amount' }
      ],
      headers
    );

    // The FILE's spelling is what comes back, because the import looks columns
    // up by exact header text.
    expect(outcome.applied.map(mapping => mapping.sourceColumn)).toEqual(['Paid out', 'Paid in']);
    expect(outcome.notInFile).toEqual([]);
  });

  /**
   * The line between forgiving and guessing. 'Paid' is not 'Paid out', and a
   * wrong column silently mapped is worse than one reported missing — the
   * user can see a missing column; they cannot see a wrong one until the
   * register disagrees with the bank.
   */
  it('reports a near-miss as missing rather than guessing which column was meant', () => {
    const outcome = applyMappingPrefill([{ sourceColumn: 'Paid', targetField: 'amount' }], headers);

    expect(outcome.applied).toEqual([]);
    expect(outcome.notInFile).toEqual(['Paid']);
  });

  it('keeps both halves of a debit/credit pair', () => {
    const outcome = applyMappingPrefill(
      [
        { sourceColumn: 'Paid out', targetField: 'amount' },
        { sourceColumn: 'Paid in', targetField: 'amount' }
      ],
      headers
    );

    expect(outcome.applied).toHaveLength(2);
  });

  it('has nothing to apply, and says nothing is wrong, for an empty saved set', () => {
    expect(applyMappingPrefill([], headers)).toEqual({
      applied: [],
      notInFile: [],
      notImported: []
    });
  });
});
