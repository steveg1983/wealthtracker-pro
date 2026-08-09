import { describe, it, expect } from 'vitest';
import { groupUncategorisedByAccount } from '../uncategorisedByAccount';
import type { SplitExpandedTransaction } from '../transactionSplits';

const NAMES: Record<string, string> = {
  a: 'Argent Gold',
  b: 'Bridgeford Current',
  h: 'Harwich Premier',
};

const nameOf = (id: string): string => NAMES[id] ?? 'Unknown account';

function row(accountId: string, id: string): SplitExpandedTransaction {
  // Only accountId is read by the grouping; the rest is shape, not substance.
  return { id, accountId } as SplitExpandedTransaction;
}

describe('groupUncategorisedByAccount', () => {
  it('returns nothing when there is nothing outstanding', () => {
    expect(groupUncategorisedByAccount([], nameOf)).toEqual([]);
  });

  it('gathers every row under its own account', () => {
    const result = groupUncategorisedByAccount(
      [row('h', '1'), row('a', '2'), row('h', '3')],
      nameOf
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ accountId: 'h' });
    expect(result[0].rows.map(r => r.id)).toEqual(['1', '3']);
    expect(result[1]).toMatchObject({ accountId: 'a' });
  });

  it('puts the account with the most work first', () => {
    const result = groupUncategorisedByAccount(
      [row('a', '1'), row('h', '2'), row('h', '3'), row('h', '4'), row('b', '5'), row('b', '6')],
      nameOf
    );

    expect(result.map(g => g.accountId)).toEqual(['h', 'b', 'a']);
  });

  it('breaks a tie by account name, not by arrival order', () => {
    // Same count each. Harwich's rows arrive first, but Argent sorts first by name.
    const result = groupUncategorisedByAccount(
      [row('h', '1'), row('b', '2'), row('a', '3')],
      nameOf
    );

    expect(result.map(g => g.accountId)).toEqual(['a', 'b', 'h']);
  });

  it('orders the same way whatever order the rows arrive in', () => {
    const rows = [row('h', '1'), row('b', '2'), row('a', '3')];
    const forwards = groupUncategorisedByAccount(rows, nameOf).map(g => g.accountId);
    const backwards = groupUncategorisedByAccount([...rows].reverse(), nameOf).map(g => g.accountId);

    expect(backwards).toEqual(forwards);
  });

  it('still sorts accounts it cannot name', () => {
    const result = groupUncategorisedByAccount([row('zzz', '1'), row('a', '2')], nameOf);

    expect(result.map(g => g.accountId)).toEqual(['a', 'zzz']);
  });
});
