import {
  USER, NEW_DISMISSAL,
  dismissalShape, subjectsInRoleOrder, dismissalsOwnedBy, subjectRowsInTotal,
} from './_shared.mjs';

// THE SPEC THAT PINS THE CHECK SLICE 23 WIDENED.
//
// `scripts/local-sqlite/schema.sql` admitted four kinds until this slice; the
// cloud has admitted seven since 20260808190000. Narrow the CHECK back and this
// spec goes red on SQLite alone — which is what a schema gap looks like when
// somebody has bothered to write the rule down.
export default {
  invariant: 'B-7',
  title: 'a payee refusal names percent-encoded text and no rows at all',
  design: '20260808120000 and 20260808190000 added payee-merchant, payee-line and payee-hidden by DROP + ADD of suggestion_dismissals_kind_known. Their subject_key holds ROLE-TAGGED, PERCENT-ENCODED PAYEE TEXT rather than ids — the role prefix keeps the restore path’s id remapping off it, and the ":" inside makes the value impossible to mistake for a uuid even when the bank’s payee text IS uuid-shaped',
  consequence: 'Settings → Payee cleanup drives all three kinds through the seam’s one dismissSuggestion door (PayeeCleanup.tsx:433, :449, :491). A four-kind CHECK is not a theoretical gap — it is that entire screen failing to save on a local file, and a cloud backup carrying one payee dismissal refused WHOLE on the way back in, which is restore_user_chunk’s all-or-nothing rule doing exactly what it says',
  parity: 'match',

  command: {
    verb: 'dismiss_suggestion',
    payload: {
      id: NEW_DISMISSAL,
      user_id: USER,
      kind: 'payee-hidden',
      // The shape 20260808190000:165-168 requires of these keys, and the ':' is
      // load-bearing: it is what stops an id remapper mistaking payee text for a
      // row id.
      subject_key: 'payee-cleanup:payee:DIRECT%20DEBIT',
      // EMPTY, and the emptiness is the feature. The prune trigger on
      // transactions never removes these rows, so deleting every transaction
      // carrying the wording and re-importing the statement does not put the
      // payee the user struck off back on the screen.
      subject_ids: [],
    },
  },

  expect: { outcome: 'ok' },

  result: {
    kind: 'payee-hidden',
    subject_key: 'payee-cleanup:payee:DIRECT%20DEBIT',
    subject_ids: [],
  },

  rowDivergence: {
    dismissed_at: 'the instant of the write, on two clocks and in two transactions',
  },

  state: [
    dismissalShape('payee-hidden', 'payee-cleanup:payee:DIRECT%20DEBIT',
      'payee-hidden:payee-cleanup:payee:DIRECT%20DEBIT:0'),
    subjectsInRoleOrder('payee-hidden', 'payee-cleanup:payee:DIRECT%20DEBIT', 'NONE'),
    dismissalsOwnedBy(USER, '1'),
    // Nothing was written to the child table, on the engine that has one.
    subjectRowsInTotal('0'),
  ],
};
