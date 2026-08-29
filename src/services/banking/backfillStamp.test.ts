import { describe, it, expect } from 'vitest';
import { stampBackfillDecision } from './backfillStamp';

const row = (account_id: string, external_transaction_id: string) => ({
  account_id,
  external_transaction_id,
  amount: -12.5
});

describe('stampBackfillDecision', () => {
  it('stamps an account with no feed history as a backfill', () => {
    const stamped = stampBackfillDecision([row('acct-1', 'n-1')], new Set());
    expect(stamped).toHaveLength(1);
    expect(stamped[0].backfill).toBe(true);
  });

  it('stamps an account that already holds feed rows as incremental', () => {
    const stamped = stampBackfillDecision([row('acct-1', 'n-1')], new Set(['acct-1']));
    expect(stamped[0].backfill).toBe(false);
  });

  it('gives every row of one account the same stamp — the RPC refuses a mixed batch', () => {
    // This is the property the whole mechanism exists for: a 469-row first
    // sync split into three 200-row chunks must carry ONE verdict end to end,
    // not re-derive it per chunk. All rows agreeing is what makes every chunk
    // take the same balance arm.
    const rows = Array.from({ length: 469 }, (_, index) => row('acct-1', `n-${index}`));
    const stamped = stampBackfillDecision(rows, new Set());
    expect(stamped).toHaveLength(469);
    expect(new Set(stamped.map((item) => item.backfill))).toEqual(new Set([true]));
  });

  it('decides per account when a sync spans several', () => {
    const stamped = stampBackfillDecision(
      [row('fresh', 'n-1'), row('fed', 'n-2'), row('fresh', 'n-3')],
      new Set(['fed'])
    );
    expect(stamped.map((item) => item.backfill)).toEqual([true, false, true]);
  });

  it('keeps every original field and does not mutate its input', () => {
    const input = [row('acct-1', 'n-1')];
    const stamped = stampBackfillDecision(input, new Set());
    expect(stamped[0]).toMatchObject(input[0]);
    expect('backfill' in input[0]).toBe(false);
  });

  it('passes an empty sync through empty', () => {
    expect(stampBackfillDecision([], new Set())).toEqual([]);
  });
});
