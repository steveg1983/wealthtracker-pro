import {
  USER, EVERYDAY, CORNER_SHOP, SECOND_ROW,
  PAIR_DISMISSAL, STRANDED_DISMISSAL, DISMISSED_FIRST,
  twoDismissals, listedDismissal, balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-1',
  title: 'the dismissals come back newest first — the one direction none of the other reads uses',
  design: 'suggestionDismissalService.list: .select(\'id, kind, subject_key, subject_ids, dismissed_at\').eq(\'user_id\', …).order(\'dismissed_at\', { ascending: false }). Five named columns rather than *, so the answer carries five and user_id is not among them',
  consequence: 'every other read here is oldest-first, so a port written by pattern-matching the one beside it would reverse this list. It is what the "restore a dismissed suggestion" screen is drawn from, and the most recently refused suggestion is the one somebody is most likely to want back',
  parity: 'match',

  setup: twoDismissals,
  command: { verb: 'list_suggestion_dismissals', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    suggestion_dismissals: [
      listedDismissal({
        id: PAIR_DISMISSAL, kind: 'transfer-pair', subject_key: 'the pair',
        subject_ids: [SECOND_ROW, CORNER_SHOP],
      }),
      listedDismissal({
        id: STRANDED_DISMISSAL, kind: 'stranded', subject_key: 'the stranded one',
        subject_ids: [CORNER_SHOP], dismissed_at: DISMISSED_FIRST,
      }),
    ],
  },
  state: [balanceIdentityHolds(EVERYDAY), auditRowsInTotal('0')],
};
