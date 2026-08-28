import { describe, it, expect } from 'vitest';
import { applyFeedRules, feedSafeRules, hasActionAFeedIgnores } from './feedRules';
import type { ImportRule } from '../../types/importRules';

const rule = (over: Partial<ImportRule> = {}): ImportRule => ({
  id: 'r1',
  name: 'Amazon',
  enabled: true,
  priority: 1,
  conditions: [{ field: 'description', operator: 'contains', value: 'amazon uk' }],
  actions: [{ type: 'setCategory', value: 'cat-trackday' }],
  createdAt: new Date('2026-08-28'),
  updatedAt: new Date('2026-08-28'),
  ...over
});

const feedRow = (over = {}) => ({
  account_id: 'acct-1',
  description: 'AMAZON UK MARKETPLACE',
  amount: -24.99,
  date: '2026-08-28',
  ...over
});

describe('the rules a bank feed is allowed to obey', () => {
  it('categorises a fed transaction — the thing the owner actually asked for', () => {
    const { row, changed } = applyFeedRules(feedRow(), [rule()]);

    expect(changed).toBe(true);
    expect(row.category).toBe('cat-trackday');
  });

  it('renames and tags, because those change how a row READS and nothing else', () => {
    const { row } = applyFeedRules(feedRow(), [
      rule({
        actions: [
          { type: 'modifyDescription', modification: 'replace', value: 'Amazon' },
          { type: 'addTag', value: 'online' }
        ]
      })
    ]);

    expect(row.description).toBe('Amazon');
    expect(row.tags).toEqual(['online']);
  });

  it('IGNORES skip — a bank transaction never silently fails to arrive', () => {
    // The owner's ruling. Skipping a file row is recoverable; skipping a fed
    // row means the ledger quietly stops agreeing with the statement.
    const { row, changed } = applyFeedRules(feedRow(), [rule({ actions: [{ type: 'skip' }] })]);

    expect(changed).toBe(false);
    expect(row.description).toBe('AMAZON UK MARKETPLACE');
  });

  it('still categorises when one rule asks for both a category and a skip', () => {
    // The safe half of a mixed rule is honoured; only the skip is dropped.
    const { row, changed } = applyFeedRules(feedRow(), [
      rule({ actions: [{ type: 'setCategory', value: 'cat-trackday' }, { type: 'skip' }] })
    ]);

    expect(changed).toBe(true);
    expect(row.category).toBe('cat-trackday');
  });

  it('IGNORES setAccount — a fed row belongs to the account the bank sent it for', () => {
    const { row, changed } = applyFeedRules(feedRow(), [
      rule({ actions: [{ type: 'setAccount', value: 'acct-elsewhere' }] })
    ]);

    expect(changed).toBe(false);
    expect(row.account_id).toBe('acct-1');
  });

  it('leaves a row alone when nothing matches, so the reported count means something', () => {
    const { row, changed } = applyFeedRules(feedRow({ description: 'TESCO' }), [rule()]);

    expect(changed).toBe(false);
    expect(row.category).toBeUndefined();
  });

  it('ignores a disabled rule', () => {
    const { changed } = applyFeedRules(feedRow(), [rule({ enabled: false })]);

    expect(changed).toBe(false);
  });

  it('applies rules in priority order, lowest first', () => {
    const { row } = applyFeedRules(feedRow(), [
      rule({ id: 'late', priority: 9, actions: [{ type: 'setCategory', value: 'cat-late' }] }),
      rule({ id: 'early', priority: 1, actions: [{ type: 'setCategory', value: 'cat-early' }] })
    ]);

    // Both match; the later rule wins because it runs last — the same
    // precedence the CSV importer gives them.
    expect(row.category).toBe('cat-late');
  });
});

describe('which rules a feed quietly does less with', () => {
  it('names a rule the feed cannot fully carry out, so the panel can say so', () => {
    expect(hasActionAFeedIgnores(rule({ actions: [{ type: 'skip' }] }))).toBe(true);
    expect(hasActionAFeedIgnores(rule())).toBe(false);
  });

  it('drops a rule whose every action a feed refuses, rather than running an empty one', () => {
    expect(feedSafeRules([rule({ actions: [{ type: 'skip' }] })])).toEqual([]);
  });

  it('keeps the safe half of a mixed rule', () => {
    const [kept] = feedSafeRules([
      rule({ actions: [{ type: 'skip' }, { type: 'addTag', value: 'x' }] })
    ]);

    expect(kept.actions).toEqual([{ type: 'addTag', value: 'x' }]);
  });
});
