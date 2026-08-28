/**
 * The carry-over is the risky half of moving rules into the account: the
 * owner's existing rules only exist in one browser, and a migration that
 * quietly drops one has destroyed work nobody can get back.
 */
import { describe, it, expect } from 'vitest';
import { toRule } from './importRulesStore';
import { isWellFormed } from './ruleShape';
import type { ImportRule } from '../../types/importRules';

const complete = (over: Partial<ImportRule> = {}): Partial<ImportRule> => ({
  name: 'Auto-categorize "amazon uk"',
  enabled: true,
  priority: 1,
  conditions: [{ field: 'description', operator: 'contains', value: 'amazon uk' }],
  actions: [{ type: 'setCategory', value: 'cat-1' }],
  ...over
});

describe('which local rules are safe to move into an account', () => {
  it('accepts a real rule', () => {
    expect(isWellFormed(complete())).toBe(true);
  });

  it('refuses a rule with no conditions, which would match every transaction ever imported', () => {
    expect(isWellFormed(complete({ conditions: [] }))).toBe(false);
  });

  it('refuses a rule with no actions, which would do nothing to any of them', () => {
    expect(isWellFormed(complete({ actions: [] }))).toBe(false);
  });

  it('refuses a nameless rule — the owner could never find it again to delete it', () => {
    expect(isWellFormed(complete({ name: '   ' }))).toBe(false);
  });

  it('refuses rubbish where the arrays should be, rather than trusting localStorage', () => {
    // localStorage holds whatever a previous build wrote, and JSON.parse is
    // happy to return any shape at all.
    const notArrays = { name: 'x', enabled: true, priority: 1 } as Partial<ImportRule>;
    expect(isWellFormed(notArrays)).toBe(false);
  });
});

describe('reading a rule back out of the account', () => {
  const row = {
    id: 'uuid-1',
    name: 'Groceries',
    description: null,
    enabled: true,
    priority: 2,
    conditions: [{ field: 'description', operator: 'contains', value: 'tesco' }],
    actions: [{ type: 'setCategory', value: 'cat-food' }],
    created_at: '2026-08-28T10:00:00.000Z',
    updated_at: '2026-08-28T11:00:00.000Z'
  };

  it('restores the shape the engine expects, with real Dates', () => {
    const rule = toRule(row);

    expect(rule.id).toBe('uuid-1');
    expect(rule.conditions).toHaveLength(1);
    expect(rule.actions).toHaveLength(1);
    expect(rule.createdAt).toBeInstanceOf(Date);
    expect(rule.updatedAt.toISOString()).toBe('2026-08-28T11:00:00.000Z');
  });

  it('omits an absent description rather than inventing an empty one', () => {
    expect(toRule(row)).not.toHaveProperty('description');
  });

  it('survives a row whose JSON columns are not arrays', () => {
    // Defence against a hand-edited row: the engine iterates these, so a
    // non-array here would throw mid-import rather than simply not matching.
    const damaged = toRule({ ...row, conditions: null, actions: 'nonsense' });

    expect(damaged.conditions).toEqual([]);
    expect(damaged.actions).toEqual([]);
  });
});
