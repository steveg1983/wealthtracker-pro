import { describe, it, expect } from 'vitest';
import {
  countUnreconciled,
  isMarkedAwaitingFinalize,
  isReconciled,
  reconciledAfterMarking,
} from './transactionReconciliation';

/**
 * The three-valued rule, pinned. It is read by the Accounts column, the
 * reconciliation list, the register's totals, the archive and two stores, so a
 * change here is a change to all of them at once — which is exactly why the
 * rule lives in one file and is tested in one file.
 */
describe('isReconciled', () => {
  it('answers with the committed flag when the row has one', () => {
    expect(isReconciled({ cleared: true, reconciled: true })).toBe(true);
    expect(isReconciled({ cleared: true, reconciled: false })).toBe(false);
    expect(isReconciled({ cleared: false, reconciled: false })).toBe(false);
  });

  it('falls back to the mark for a row that predates the split', () => {
    // null is what a row written before migration 20260810200000 carries;
    // undefined is what a database without that migration returns at all. Both
    // describe the one-flag world, where a marked row WAS a reconciled row.
    expect(isReconciled({ cleared: true, reconciled: null })).toBe(true);
    expect(isReconciled({ cleared: true })).toBe(true);
    expect(isReconciled({ cleared: false })).toBe(false);
    expect(isReconciled({})).toBe(false);
  });
});

describe('isMarkedAwaitingFinalize', () => {
  it('is the working set: marked, and not committed', () => {
    expect(isMarkedAwaitingFinalize({ cleared: true, reconciled: false })).toBe(true);
    expect(isMarkedAwaitingFinalize({ cleared: true, reconciled: true })).toBe(false);
    expect(isMarkedAwaitingFinalize({ cleared: false, reconciled: false })).toBe(false);
    // Pre-split rows are not work in progress — they read as committed.
    expect(isMarkedAwaitingFinalize({ cleared: true })).toBe(false);
  });
});

describe('countUnreconciled', () => {
  it('counts rows that are not committed, whatever their marks say', () => {
    expect(countUnreconciled([
      { cleared: true, reconciled: false },
      { cleared: true, reconciled: true },
      { cleared: false, reconciled: false },
      { cleared: true },
    ])).toBe(2);
  });
});

describe('reconciledAfterMarking', () => {
  it('leaves a commitment alone when marking', () => {
    expect(reconciledAfterMarking({ cleared: true, reconciled: true }, true)).toBe(true);
    expect(reconciledAfterMarking({ cleared: false, reconciled: false }, true)).toBe(false);
  });

  it('takes the commitment with it when unmarking', () => {
    // reconciled implies cleared: a row that is not ticked cannot be a row a
    // statement was balanced against.
    expect(reconciledAfterMarking({ cleared: true, reconciled: true }, false)).toBe(false);
    expect(reconciledAfterMarking({ cleared: true }, false)).toBe(false);
  });
});
