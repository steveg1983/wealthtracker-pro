import { describe, it, expect } from 'vitest';
import { readDuplicateSweepSession } from './duplicateSweepSession';

/**
 * The crumbs the duplicate sweep leaves itself before sending the user out to
 * the register. They are read back off a history entry that may have been
 * written by a build which is no longer running, so the rule is: a field that
 * cannot be read falls back to the sweep's own default, and only the pair key
 * — the one thing that has no sensible default — can refuse the whole record.
 */

const crumbs = {
  tool: 'find-duplicates',
  windowDays: 7,
  accountFilter: 'acc-1',
  sortKey: 'amount',
  sortDir: 1,
  pairKey: 'pair-a|pair-b',
  reviewing: true,
};

describe('readDuplicateSweepSession', () => {
  it('reads back a full set of crumbs', () => {
    expect(readDuplicateSweepSession({ resume: crumbs })).toEqual(crumbs);
  });

  it('is null for an ordinary visit to the page', () => {
    expect(readDuplicateSweepSession(null)).toBeNull();
    expect(readDuplicateSweepSession({})).toBeNull();
    expect(readDuplicateSweepSession({ resume: {} })).toBeNull();
  });

  it('is null for another tool’s crumbs — this page hosts several dialogs', () => {
    expect(readDuplicateSweepSession({ resume: { ...crumbs, tool: 'match-transfers' } })).toBeNull();
  });

  it('is null without a pair to return to', () => {
    expect(readDuplicateSweepSession({ resume: { ...crumbs, pairKey: '' } })).toBeNull();
  });

  it('falls back rather than refusing when a control cannot be read', () => {
    const session = readDuplicateSweepSession({
      resume: { tool: 'find-duplicates', pairKey: 'p', windowDays: 99, sortKey: 'colour', sortDir: 'up' },
    });
    // Back at the defaults, but back — the bug being fixed is arriving at no
    // dialog at all, not arriving at one sorted the wrong way.
    expect(session).toEqual({
      tool: 'find-duplicates',
      windowDays: 3,
      accountFilter: '',
      sortKey: 'date',
      sortDir: -1,
      pairKey: 'p',
      reviewing: false,
    });
  });
});
