import {
  USER, EVERYDAY, CORNER_SHOP,
  enriched, balanceIdentityHolds, storedFlag, auditRowsInTotal,
} from './_shared.mjs';

// BEHAVIOUR CLASS 4, the boolean half — and the field with the history.
//
//     is_cleared = COALESCE((p->>'is_cleared')::boolean, is_cleared)
//                                                       -- 20260808100000:325
//
// MEASURED, reference cluster: `''::boolean` is
// `invalid input syntax for type boolean: ""`. `null` keeps the old value
// (COALESCE), `""` refuses, and there is no spelling of "unreconcile this" that
// goes through an empty string — that is `{"is_cleared": false}`.
//
// Worth its own file rather than folding into the amount spec, for two reasons.
// The cast is a different one, so it is a different measurement. And is_cleared
// is the column whose absence from the UPDATE list caused the 2026-07 incident
// (20260707120000:5-11): "the reconciliation page's cleared checkbox silently
// did nothing (the RPC 'succeeded' without touching is_cleared) ... so a
// reconciliation difference could never reach zero." A field with that record
// gets its own assertion.
//
// The local edition refuses this at its `Flag` boundary, which reproduces
// Postgres's accepted set exactly — `t`, `yes`, `off`, `0` and the rest all
// work on both — and stops at the same place: `""` and the ambiguous `"o"`.
export default {
  invariant: 'TS-T3',
  title: 'an empty is_cleared is refused by both engines, not read as "leave it alone"',
  design: "update_transaction_atomic 20260808100000:325 — a boolean cast; MEASURED ''::boolean raises",
  consequence: "reading '' as absent here would make a reconciliation toggle that sends a blank value silently do nothing, which is the 2026-07 incident (20260707120000:5-11) exactly",
  parity: 'match',

  setup: enriched,

  command: {
    verb: 'update_transaction',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      patch: { is_cleared: '' },
    },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'boolean_invalid' },
    postgres: { outcome: 'refused', error: 'invalid input syntax for type boolean' },
  },

  state: [
    // Unchanged from `enriched`, which set it true — so this asserts the
    // refusal did not flip it either way.
    storedFlag(CORNER_SHOP, 'is_cleared', 'yes'),
    balanceIdentityHolds(EVERYDAY),
    auditRowsInTotal('0'),
  ],
};
