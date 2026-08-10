/**
 * Can this counterpart be PROVED to be scaffolding the app created?
 *
 * The verdict is one-way by design, and these tests are mostly about the
 * direction it fails in: anything unproved must come back "ask the user",
 * because moving a real bank row into another account is the expensive mistake
 * and asking unnecessarily is the cheap one.
 */

import { describe, it, expect } from 'vitest';
import { describeCounterpartOrigin } from './transferCounterpartOrigin';

const born = new Date('2026-06-10T09:00:00.000Z');

/** What create_transfer_counterpart leaves behind: born linked, never touched. */
const scaffolding = {
  cleared: false,
  statementSequence: null,
  needsReview: false,
  createdAt: born,
  updatedAt: born,
};

describe('describeCounterpartOrigin', () => {
  it('proves a row created as the other half and untouched since', () => {
    const verdict = describeCounterpartOrigin(scaffolding);
    expect(verdict.systemCreated).toBe(true);
    expect(verdict.reasons).toEqual([]);
  });

  it('refuses to prove it once the row has been written to', () => {
    // update_transactions_updated_at is a BEFORE UPDATE trigger on every row,
    // so any write at all moves the two timestamps apart. A linked row that HAS
    // been written to may have been linked by that write — link_transfer_pair,
    // the MS Money importer's second pass, a restore — which is a real row that
    // was matched, not one that was made.
    const verdict = describeCounterpartOrigin({
      ...scaffolding,
      updatedAt: new Date('2026-06-11T09:00:00.000Z'),
    });
    expect(verdict.systemCreated).toBe(false);
    expect(verdict.reasons.join(' ')).toContain('matched to it, not created for it');
  });

  it('refuses to prove it when there are no timestamps at all', () => {
    // The browser/demo store does not stamp them. "Cannot tell" is the honest
    // answer, and the honest answer here is the safe one.
    const verdict = describeCounterpartOrigin({
      cleared: false, statementSequence: null, needsReview: false,
      createdAt: undefined, updatedAt: undefined,
    });
    expect(verdict.systemCreated).toBe(false);
  });

  it('accepts an ISO string as readily as a Date', () => {
    const verdict = describeCounterpartOrigin({
      ...scaffolding,
      createdAt: born,
      updatedAt: new Date(born.toISOString()),
    });
    expect(verdict.systemCreated).toBe(true);
  });

  it('says a reconciled row is the bank’s, whatever its timestamps say', () => {
    const verdict = describeCounterpartOrigin({ ...scaffolding, cleared: true });
    expect(verdict.systemCreated).toBe(false);
    expect(verdict.reasons[0]).toContain('reconciled');
  });

  it('says a row with a statement position came off a file', () => {
    const verdict = describeCounterpartOrigin({ ...scaffolding, statementSequence: 12 });
    expect(verdict.systemCreated).toBe(false);
    expect(verdict.reasons[0]).toContain('statement file');
  });

  it('says a row still awaiting review arrived on an import', () => {
    const verdict = describeCounterpartOrigin({ ...scaffolding, needsReview: true });
    expect(verdict.systemCreated).toBe(false);
    expect(verdict.reasons[0]).toContain('import');
  });

  it('collects every reason, strongest first', () => {
    const verdict = describeCounterpartOrigin({
      cleared: true,
      statementSequence: 3,
      needsReview: true,
      createdAt: born,
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    expect(verdict.systemCreated).toBe(false);
    expect(verdict.reasons).toHaveLength(4);
    expect(verdict.reasons[0]).toContain('reconciled');
  });
});
