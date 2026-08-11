import {
  USER, twoDismissals,
  dismissalShape, dismissalsOwnedBy, subjectRowsInTotal, auditRowsInTotal,
} from './_shared.mjs';

// "Restore" restores the SUGGESTION, not the dismissal. There is no flag, no
// undismissed_at, no soft delete: the row that recorded the refusal goes, and the
// next sweep finds nothing hiding its offer.
export default {
  invariant: 'X-6',
  title: 'undoing a refusal removes the row rather than flagging it',
  design: 'suggestionDismissalService.restore:126-131 — .delete().eq(user_id).eq(kind).eq(subject_key), against close_account’s is_active = false. 20260806180000:126-128 has no UPDATE policy "because a dismissal is never edited: it is created when the user refuses, and deleted when they change their mind", and schema.sql holds the same rule as trg_dismissals_no_update, which would ABORT a flag',
  consequence: 'a dismissal that only looked undone would go on hiding the suggestion after the user asked for it back, and the "Dismissed" list’s restore button would appear not to work — which is the same class of bug, in the same feature, as the one the whole table was added to fix',
  parity: 'match',

  setup: twoDismissals,

  command: {
    verb: 'restore_suggestion',
    payload: { user_id: USER, kind: 'transfer-pair', subject_key: 'the pair' },
  },

  expect: { outcome: 'ok' },

  result: { deleted: 1 },

  state: [
    dismissalShape('transfer-pair', 'the pair', 'GONE'),
    // The other refusal is untouched: the key carries `kind` AND `subject_key`,
    // and a delete that dropped either would take both.
    dismissalShape('stranded', 'the stranded one', 'stranded:the stranded one:1'),
    dismissalsOwnedBy(USER, '1'),
    // THE CASCADE, MEASURED. The pair named two rows and the survivor names one,
    // so two subject rows went and one remains. Measured rather than trusted, the
    // obligation delete_goal set: the verb does not walk the child rows, so the
    // file has to be caught actually doing it. The cloud reaches the same total
    // by having nothing to cascade at all — the array was in the deleted row.
    subjectRowsInTotal('1'),
    auditRowsInTotal('0'),
  ],
};
