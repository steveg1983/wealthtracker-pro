import {
  USER, EVERYDAY, CORNER_SHOP, OUTGOINGS,
  enriched, balanceIdentityHolds, storedFlag, storedText,
} from './_shared.mjs';

// The three-way CASE, branch 2 — the branch that exists so an editor cannot get
// this wrong by forgetting.
//
//     category_confirmed = CASE
//       WHEN p ? 'category_confirmed'
//         THEN COALESCE((p->>'category_confirmed')::boolean, category_confirmed)
//       WHEN p ? 'category' AND (p->>'category') IS DISTINCT FROM category
//         THEN true
//       ELSE category_confirmed
//     END                                              -- 20260808100000:312-319
//
// The cloud's own note (20260808100000:266-281) says why the middle branch is in
// SQL rather than left to callers: "Choosing a category IS vouching for it. Any
// editor that forgets to say so still gets this right, and an editor that forgot
// would otherwise leave the user's own choice sitting on screen accused of being
// a machine guess."
//
// Two things a port loses by writing this in application code instead:
//
//   * the bare `category` on the right-hand side is the OLD value, per the SQL
//     standard for UPDATE ... SET. VERIFIED in SQLite, because the whole branch
//     rests on it: `UPDATE t SET a='new', b=CASE WHEN 'new' IS NOT a THEN 1 ELSE
//     0 END` leaves b = 1.
//   * `IS DISTINCT FROM` is NULL-safe, so filing a previously-uncategorised row
//     also counts as a change. `IS NOT` is SQLite's spelling of it.
//
// The row starts with category_confirmed = false (the app guessed) and the
// payload only changes the category. Nothing says "confirmed" and it becomes
// confirmed anyway; that is the rule.
export default {
  invariant: 'TS-M3',
  title: 'changing the category confirms it, even though the caller never said so',
  design: 'update_transaction_atomic 20260808100000:312-319, rationale at :266-281',
  consequence: "without it, every category the user personally picks in the edit modal stays flagged as a machine guess and is offered back to them for confirmation — the bulk tool becomes slower than doing it one at a time",
  parity: 'match',

  setup: enriched,

  command: {
    verb: 'update_transaction',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      patch: { category: OUTGOINGS },
    },
  },

  expect: { outcome: 'ok' },
  result: { category: OUTGOINGS, category_confirmed: true },

  state: [
    storedText(CORNER_SHOP, 'category', OUTGOINGS),
    storedFlag(CORNER_SHOP, 'category_confirmed', 'yes'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
