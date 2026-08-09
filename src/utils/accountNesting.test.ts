import { describe, it, expect } from 'vitest';
import {
  buildChildrenByParent,
  buildTopLevelIdByAccountId,
  groupByTopLevelId,
  selectTopLevelAccounts,
  type NestableAccount,
} from './accountNesting';

/**
 * The nesting rules the Accounts and Investments pages share. Everything here
 * is about the cases the DATA can produce but the UI cannot: a parent that has
 * been closed, a row pointing at itself, a cycle. Getting those wrong loses an
 * account off the page or hangs it.
 */

const account = (id: string, parentAccountId?: string | null): NestableAccount => ({
  id,
  ...(parentAccountId === undefined ? {} : { parentAccountId }),
});

describe('buildChildrenByParent', () => {
  it('groups children under their parent, in the order given', () => {
    const accounts = [
      account('isa'),
      account('isa-cash', 'isa'),
      account('isa-savings', 'isa'),
      account('everyday'),
    ];

    const children = buildChildrenByParent(accounts);

    expect(children.get('isa')?.map(a => a.id)).toEqual(['isa-cash', 'isa-savings']);
    expect(children.has('everyday')).toBe(false);
    expect(children.has('isa-cash')).toBe(false);
  });

  it('ignores a parent that is not in the set, so a closed parent nests nothing', () => {
    const children = buildChildrenByParent([account('orphan', 'closed-parent')]);

    expect(children.size).toBe(0);
  });

  it('ignores an account that points at itself', () => {
    const children = buildChildrenByParent([account('self', 'self')]);

    expect(children.size).toBe(0);
  });
});

describe('selectTopLevelAccounts', () => {
  it('keeps everything whose parent is not in the set', () => {
    const accounts = [
      account('isa'),
      account('isa-cash', 'isa'),
      // The parent is closed and therefore absent: the child must still
      // appear, at top level, rather than vanish from the page.
      account('orphan', 'closed-parent'),
      account('unpaired', null),
    ];

    expect(selectTopLevelAccounts(accounts).map(a => a.id)).toEqual(['isa', 'orphan', 'unpaired']);
  });

  it('treats a self-referencing row as unparented rather than losing it', () => {
    expect(selectTopLevelAccounts([account('self', 'self')]).map(a => a.id)).toEqual(['self']);
  });
});

describe('buildTopLevelIdByAccountId', () => {
  it('resolves each account to its outermost ancestor', () => {
    const map = buildTopLevelIdByAccountId([
      account('isa'),
      account('isa-cash', 'isa'),
      account('isa-cash-sub', 'isa-cash'),
      account('everyday'),
    ]);

    expect(map.get('isa')).toBe('isa');
    expect(map.get('isa-cash')).toBe('isa');
    expect(map.get('isa-cash-sub')).toBe('isa');
    expect(map.get('everyday')).toBe('everyday');
  });

  it('falls back to the account itself when the parent is not in the set', () => {
    const map = buildTopLevelIdByAccountId([account('orphan', 'closed-parent')]);

    expect(map.get('orphan')).toBe('orphan');
  });

  it('terminates on a cycle instead of walking forever', () => {
    const two = buildTopLevelIdByAccountId([account('a', 'b'), account('b', 'a')]);
    expect(two.get('a')).toBe('b');
    expect(two.get('b')).toBe('a');

    const three = buildTopLevelIdByAccountId([
      account('a', 'b'),
      account('b', 'c'),
      account('c', 'a'),
    ]);
    expect(three.size).toBe(3);
  });

  it('treats a self-referencing row as its own top level', () => {
    expect(buildTopLevelIdByAccountId([account('self', 'self')]).get('self')).toBe('self');
  });
});

describe('groupByTopLevelId', () => {
  it('puts every account in exactly one group, alongside its top-level account', () => {
    const accounts = [
      account('isa'),
      account('isa-cash', 'isa'),
      account('isa-cash-sub', 'isa-cash'),
      account('everyday'),
      account('orphan', 'closed-parent'),
    ];

    const groups = groupByTopLevelId(accounts, buildTopLevelIdByAccountId(accounts));

    expect(groups.get('isa')?.map(a => a.id)).toEqual(['isa', 'isa-cash', 'isa-cash-sub']);
    expect(groups.get('everyday')?.map(a => a.id)).toEqual(['everyday']);
    expect(groups.get('orphan')?.map(a => a.id)).toEqual(['orphan']);
    expect([...groups.values()].flat()).toHaveLength(accounts.length);
  });
});
