import {
  USER, twoDismissals, dismissalsOwnedBy, subjectRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'X-6',
  title: 'undoing a refusal nobody made is a successful nothing',
  design: 'suggestionDismissalService.restore:126-136 — the delete carries no .single(), reports no count, and the method returns Promise<void>. The seam asks for the same by name',
  consequence: 'a double-click, or a second device that got there first, must not turn a decision into an error message. The same rule delete_budget keeps, and for the same reason: idempotence is what makes the retry safe',
  parity: 'match',

  setup: twoDismissals,

  command: {
    verb: 'restore_suggestion',
    // The right KIND with the wrong key. Both halves of the natural key have to
    // match, so this names nothing — and a verb that matched on kind alone would
    // erase every transfer-pair refusal the login has.
    payload: { user_id: USER, kind: 'transfer-pair', subject_key: 'a pair nobody refused' },
  },

  expect: { outcome: 'ok' },

  result: { deleted: 0 },

  state: [
    dismissalsOwnedBy(USER, '2'),
    subjectRowsInTotal('3'),
  ],
};
