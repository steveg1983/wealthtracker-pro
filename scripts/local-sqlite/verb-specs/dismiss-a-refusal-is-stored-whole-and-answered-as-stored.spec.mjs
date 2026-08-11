import {
  USER, CORNER_SHOP, NEW_DISMISSAL,
  dismissalShape, subjectsInRoleOrder, dismissalsOwnedBy, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'R-1',
  title: 'a refusal is stored whole and answered with as stored',
  design: 'suggestionDismissalService.dismiss:98-102 — one insert of four keys, then .select(id, kind, subject_key, subject_ids, dismissed_at).single(), so the caller can put the answer straight into state without re-reading',
  consequence: 'the whole feature exists because a refusal that is not really on record comes back tomorrow: the user answers "never show me this again", the row vanishes for the session, and the sweep offers it again on the next scan — "the same list that you said you wanted to leave come back up again and again"',
  parity: 'match',

  command: {
    verb: 'dismiss_suggestion',
    payload: {
      id: NEW_DISMISSAL,
      user_id: USER,
      kind: 'duplicate',
      subject_key: `${CORNER_SHOP}|${CORNER_SHOP}`,
      subject_ids: [CORNER_SHOP],
    },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    dismissed_at: 'the instant of the write, on two clocks and in two transactions — the column default on both engines, which is exactly why no verb names the column',
  },

  result: {
    kind: 'duplicate',
    subject_key: `${CORNER_SHOP}|${CORNER_SHOP}`,
    subject_ids: [CORNER_SHOP],
  },

  state: [
    dismissalShape('duplicate', `${CORNER_SHOP}|${CORNER_SHOP}`, 'duplicate:' + `${CORNER_SHOP}|${CORNER_SHOP}` + ':1'),
    subjectsInRoleOrder('duplicate', `${CORNER_SHOP}|${CORNER_SHOP}`, CORNER_SHOP.slice(-4)),
    dismissalsOwnedBy(USER, '1'),
    // The absence, ASSERTED. See the dedicated spec for the argument; it is
    // repeated here because a state probe that only ever ran in one file would
    // be an absence nobody checked on the path people actually take.
    auditRowsInTotal('0'),
  ],
};
