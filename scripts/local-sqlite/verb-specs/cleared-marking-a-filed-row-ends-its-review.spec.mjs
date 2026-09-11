import { USER, EVERYDAY, FILED_ROW, GUESSED_ROW, THIS_LEG, everyShapeOfFiling, transferPair,
  storedFlag, auditRowsForUpdate, balanceIdentityHolds } from './_shared.mjs';

// THE OWNER'S RULING, 11 Sep 2026: ticking a row off against a statement is
// doing something about it, so it ends the row's review — "only if it has a
// category for expense or income, or has been assigned a transfer account".
// Three shapes of FILED are marked here: a row vouched for, a row filed as a
// suggestion (a category is a category, confirmed or not), and a transfer leg
// whose category is NULL — filed by being a transfer. All three arrive bold.
//
// The C/R half of the verb is untouched by this and is pinned by its own
// specs; here only the review column is at stake.
export default {
  invariant: 'A-1',
  title: 'marking a filed row cleared ends its review',
  design: 'set_transactions_cleared 20260911213000 — v_filed, and the needs_review CASE beside the C/R one',
  consequence: 'a row the owner has matched to a statement stays bold in To Review with nothing left to answer — 35 of his partner\'s transfers did, 11 Sep 2026',
  parity: 'match',

  setup: {
    sqlite: `${everyShapeOfFiling.sqlite}
      ${transferPair.sqlite}
      UPDATE transactions SET needs_review = 1
       WHERE id IN ('${FILED_ROW}', '${GUESSED_ROW}', '${THIS_LEG}');`,
    postgres: `${everyShapeOfFiling.postgres}
      ${transferPair.postgres}
      UPDATE public.transactions SET needs_review = true
       WHERE id IN ('${FILED_ROW}', '${GUESSED_ROW}', '${THIS_LEG}');`,
  },
  command: { verb: 'set_transactions_cleared', payload: { ids: [FILED_ROW, GUESSED_ROW, THIS_LEG], cleared: true, user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    storedFlag(FILED_ROW, 'is_cleared', 'yes'),
    storedFlag(GUESSED_ROW, 'is_cleared', 'yes'),
    storedFlag(THIS_LEG, 'is_cleared', 'yes'),
    storedFlag(FILED_ROW, 'needs_review', 'no'),
    storedFlag(GUESSED_ROW, 'needs_review', 'no'),
    storedFlag(THIS_LEG, 'needs_review', 'no'),
    auditRowsForUpdate(FILED_ROW, '1'),
    auditRowsForUpdate(THIS_LEG, '1'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
