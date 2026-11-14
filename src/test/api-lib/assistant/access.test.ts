/**
 * WHO MAY ASK (owner, 14 Nov 2026): the top tier only, switched on per account.
 */

import { describe, it, expect } from 'vitest';
import { decideAccess, monthStart, type AccessFacts } from '../../../../api/_lib/assistant/access';

const on = { enabled: true, complimentary: false, monthly_question_limit: 200 };
const pro = { tier: 'pro', status: 'active' };

const decide = (facts: Partial<AccessFacts>) => decideAccess({ row: null, subscription: null, used: 0, ...facts });

describe('the in-app assistant: who may ask', () => {
  it('nobody is switched on by default — not even a Pro subscriber', () => {
    expect(decide({ subscription: pro })).toMatchObject({ allowed: false, reason: 'not_switched_on', limit: 0 });
  });

  it('a switch turned off is off', () => {
    expect(decide({ row: { ...on, enabled: false }, subscription: pro })).toMatchObject({ allowed: false, reason: 'not_switched_on' });
  });

  it('switched on AND on Pro may ask', () => {
    expect(decide({ row: on, subscription: pro, used: 3 })).toEqual({ allowed: true, reason: null, used: 3, limit: 200 });
  });

  it('a trial or a payment being retried still carries the plan; a cancelled one does not', () => {
    expect(decide({ row: on, subscription: { tier: 'pro', status: 'trialing' } }).allowed).toBe(true);
    expect(decide({ row: on, subscription: { tier: 'pro', status: 'past_due' } }).allowed).toBe(true);
    expect(decide({ row: on, subscription: { tier: 'pro', status: 'cancelled' } })).toMatchObject({ allowed: false, reason: 'not_on_pro' });
  });

  it('switched on but on Premium is not enough', () => {
    expect(decide({ row: on, subscription: { tier: 'premium', status: 'active' } })).toMatchObject({ allowed: false, reason: 'not_on_pro' });
  });

  it('a complimentary switch needs no subscription (the owner’s own account)', () => {
    expect(decide({ row: { ...on, complimentary: true } })).toMatchObject({ allowed: true, reason: null });
  });

  it('the monthly allowance is a hard stop at the limit, and says so', () => {
    expect(decide({ row: on, subscription: pro, used: 199 }).allowed).toBe(true);
    expect(decide({ row: on, subscription: pro, used: 200 })).toEqual({ allowed: false, reason: 'allowance_used', used: 200, limit: 200 });
  });

  it('the month is the calendar month, counted in UTC', () => {
    expect(monthStart(new Date('2026-11-14T23:30:00Z')).toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(monthStart(new Date('2026-12-01T00:00:00Z')).toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });
});
