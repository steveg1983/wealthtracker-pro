/**
 * THE LADDER — the rule that makes "amber means this one, next" true across
 * the whole app rather than four times over.
 *
 * On a real ledger four surfaces were amber at once, each correct by its own
 * lights: Accounts' feed button, Categorisation's panel, its seven Confirm
 * buttons, and Categories' data-health panel. Design ruled the ladder is
 * evaluated per APP (24 Aug), because a user does not experience one page at
 * a time.
 *
 * These pin the ORDER and its consequences. The order is a dependency chain,
 * not an importance ranking, and the test that produced it is stated in
 * attentionLadder.ts — every one of these cases is that test applied.
 */
import { describe, it, expect } from 'vitest';
import { ATTENTION_RUNGS, activeRung, rungWearsAmber } from '../attentionLadder';

describe('the attention ladder picks exactly one rung', () => {
  it('is ordered feed → review → reconcile → categorise', () => {
    // The array IS the order, so a reordering edit fails here rather than
    // silently changing what the app points at.
    expect([...ATTENTION_RUNGS]).toEqual(['feed', 'review', 'reconcile', 'categorise']);
  });

  it('says nothing at all when nothing is outstanding', () => {
    expect(activeRung({})).toBeNull();
    expect(activeRung({ feed: 0, review: 0, reconcile: 0, categorise: 0 })).toBeNull();
    // A surface that reports a clean rung must not light up.
    expect(rungWearsAmber({}, 'categorise')).toBe(false);
  });

  it('a dead feed outranks everything below it', () => {
    const state = { feed: 1, review: 29, reconcile: 7, categorise: 30 };
    expect(activeRung(state)).toBe('feed');
    // The exact situation from the owner's ledger: three other surfaces had
    // work, and all three stand down while the feed is down — because their
    // counts are not yet facts.
    expect(rungWearsAmber(state, 'review')).toBe(false);
    expect(rungWearsAmber(state, 'reconcile')).toBe(false);
    expect(rungWearsAmber(state, 'categorise')).toBe(false);
  });

  it('review outranks reconcile — you cannot honestly reconcile rows nobody has read', () => {
    const state = { feed: 0, review: 3, reconcile: 7, categorise: 30 };
    expect(activeRung(state)).toBe('review');
    expect(rungWearsAmber(state, 'reconcile')).toBe(false);
  });

  it('reconcile outranks categorise', () => {
    const state = { review: 0, reconcile: 7, categorise: 30 };
    expect(activeRung(state)).toBe('reconcile');
    expect(rungWearsAmber(state, 'categorise')).toBe(false);
  });

  it('categorise gets its turn once the chain above it is clear', () => {
    const state = { feed: 0, review: 0, reconcile: 0, categorise: 30 };
    expect(activeRung(state)).toBe('categorise');
    expect(rungWearsAmber(state, 'categorise')).toBe(true);
  });

  it('an ABSENT rung counts as clean, so no surface can silence one it cannot see', () => {
    // A page that knows only about categorise must not be able to suppress
    // the feed rung by omitting it — omission means "nothing outstanding
    // here", never "nothing outstanding anywhere".
    expect(activeRung({ categorise: 5 })).toBe('categorise');
    expect(activeRung({ feed: 1, categorise: 5 })).toBe('feed');
  });

  it('exactly one rung is ever active, for every combination', () => {
    // Exhaustive over presence/absence: 16 states, never two ambers.
    for (let mask = 0; mask < 16; mask++) {
      const state = {
        feed: mask & 1 ? 1 : 0,
        review: mask & 2 ? 1 : 0,
        reconcile: mask & 4 ? 1 : 0,
        categorise: mask & 8 ? 1 : 0,
      };
      const lit = ATTENTION_RUNGS.filter(rung => rungWearsAmber(state, rung));
      expect(lit.length, `state ${JSON.stringify(state)} lit ${lit.join(', ')}`).toBeLessThanOrEqual(1);
      const anyWork = Object.values(state).some(n => n > 0);
      expect(lit.length).toBe(anyWork ? 1 : 0);
    }
  });
});
