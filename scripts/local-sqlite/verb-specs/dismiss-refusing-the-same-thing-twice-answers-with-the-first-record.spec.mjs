import {
  USER, CORNER_SHOP, SECOND_ROW, STRANDED_DISMISSAL, SECOND_ATTEMPT, DISMISSED_FIRST,
  twoDismissals,
  dismissalShape, subjectsInRoleOrder, dismissalDate, dismissalsOwnedBy, auditRowsInTotal,
} from './_shared.mjs';

// FIRST WINS — and the second attempt deliberately differs in EVERY way it is
// allowed to, so that an engine which quietly upserted would be caught by three
// separate assertions rather than by none: a different id, a different subject,
// and a clock that has moved on by a year and a half.
export default {
  invariant: 'R-9',
  title: 'refusing the same thing twice answers with the first record and writes nothing',
  design: 'suggestionDismissalService.dismiss:104-107 — the insert raises 23505 against suggestion_dismissals_unique_subject (user_id, kind, subject_key), and the client answers with the row it FINDS rather than updating it. 20260806180000:127-128 states the consequence: "a re-refusal of something already refused is a no-op, which keeps dismissed_at meaning when you FIRST said no"',
  consequence: 'a double-click, or a second device, must not turn a decision into an error message — and must not quietly rewrite what was decided. An upsert here would move the date and replace the subjects, so the "Dismissed" list would describe the refusal back to the user with the wrong rows in it',
  parity: 'match',

  setup: twoDismissals,

  command: {
    verb: 'dismiss_suggestion',
    payload: {
      // A DIFFERENT id from the one on record. Both engines must ignore it and
      // answer with the id already stored — which is the whole assertion, and is
      // only comparable because the payload names one (see verbs.mjs on why an
      // unstated id is excluded from the row comparison).
      id: SECOND_ATTEMPT,
      user_id: USER,
      kind: 'stranded',
      subject_key: 'the stranded one',
      // A DIFFERENT subject list, in a different length. The stored one names
      // CORNER_SHOP alone.
      subject_ids: [SECOND_ROW, CORNER_SHOP],
    },
  },

  expect: { outcome: 'ok' },

  result: {
    id: STRANDED_DISMISSAL,
    kind: 'stranded',
    subject_key: 'the stranded one',
    subject_ids: [CORNER_SHOP],
  },

  state: [
    dismissalShape('stranded', 'the stranded one', 'stranded:the stranded one:1'),
    // The FIRST caller's subject, not the second's.
    subjectsInRoleOrder('stranded', 'the stranded one', CORNER_SHOP.slice(-4)),
    // "When you first said no" — the planted day, not today.
    dismissalDate('stranded', 'the stranded one', DISMISSED_FIRST.slice(0, 10)),
    // Two on record before, two after: the fixture's pair is untouched and no
    // third row appeared.
    dismissalsOwnedBy(USER, '2'),
    auditRowsInTotal('0'),
  ],
};
