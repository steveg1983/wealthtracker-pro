import {
  USER, EVERYDAY, CORNER_SHOP, WEEKLY_SHOP,
  balanceOf, balanceIdentityHolds, splitLines, auditShape,
} from './_shared.mjs';

// THE REFUSAL ORDER, PART 1 — the surprising half of it.
//
// The same payload has to produce the same FIRST error on both engines. If it
// does not, the sentence the user reads depends on where the app is running,
// and a support answer written for one edition is wrong for the other.
//
// This payload breaks two rules on one line: it names a stored line that is not
// part of this split, AND files it under a category nobody has. Reading the
// source by sections suggests `split_line_not_found` — the id is the first thing
// a reader notices, and "match the incoming line to a stored one" feels like the
// first thing a matching writer would do.
//
// It is not. MEASURED on the reference cluster, 2026-08-08: the cloud says
// `unknown category`. The stored-line lookup at `:303-309` happens AFTER every
// check that can be made from the payload alone — category, amount, target,
// To/From consistency. The port follows the statements, not the sections, and
// this spec is what would catch it if a later edit re-ordered them for tidiness.
//
// The companion spec —
// `split-a-pinned-leg-without-its-target-names-the-filing-not-the-lock.spec.mjs`
// — pins the other ordering that a section-wise reading gets wrong.
export default {
  invariant: 'S-7',
  title: 'a line that is both unknown and mis-filed is told about the category, not the id',
  design: 'set_transaction_splits_with_legs 20260806094058:279-283 runs before :303-309 — MEASURED, not inferred',
  consequence: 'the two editions give different first answers to the same request, and every support answer is right in one of them',
  parity: 'match',

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      splits: [
        {
          // Both wrong: no such line in this split, no such category.
          id: '50000000-0000-0000-0000-0000000000ff',
          category: 'c0000000-0000-0000-0000-0000000000ff',
          amount: '-15.00',
        },
        { category: WEEKLY_SHOP, amount: '-10.00' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'unknown category' },

  state: [
    splitLines(CORNER_SHOP, 'NONE'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    auditShape('NONE'),
  ],
};
