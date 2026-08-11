import {
  USER, CORNER_SHOP, SECOND_ROW, NEW_DISMISSAL,
  twoDismissals,
  dismissalShape, subjectsInRoleOrder, dismissalsOwnedBy,
} from './_shared.mjs';

// The WRITE half of the rule `read-dismissals-the-subjects-come-back-as-an-array
// -in-role-order` proves about the read. A reader that reassembles in role order
// is worth nothing if the writer stored a set.
export default {
  invariant: 'READ-7',
  title: 'the subjects are stored in the order they arrived, because the positions are roles',
  design: 'suggestion_dismissals.subject_ids is uuid[] "in role order (the row the user was looking at first)" (20260806180000:91-93); schema.sql turns the array into suggestion_dismissal_subjects with role_order, and this verb writes the caller’s list position as that column',
  consequence: 'for a transfer pair the positions say which row was the out and which the in. A writer that sorted the ids, or that let the child table fall back on insertion order, would hand the sweep back a different suggestion from the one the user refused',
  parity: 'match',

  setup: twoDismissals,

  command: {
    verb: 'dismiss_suggestion',
    payload: {
      id: NEW_DISMISSAL,
      user_id: USER,
      kind: 'transfer-pair',
      subject_key: 'out then in',
      // DELIBERATELY NOT ID ORDER: SECOND_ROW sorts after CORNER_SHOP, so an
      // engine that sorted — or that read the child table without ORDER BY
      // role_order and got rowid order — answers with these two the other way
      // round and is caught here.
      subject_ids: [SECOND_ROW, CORNER_SHOP],
    },
  },

  expect: { outcome: 'ok' },

  result: { subject_ids: [SECOND_ROW, CORNER_SHOP] },

  rowDivergence: {
    dismissed_at: 'the instant of the write, on two clocks and in two transactions',
  },

  state: [
    dismissalShape('transfer-pair', 'out then in', 'transfer-pair:out then in:2'),
    subjectsInRoleOrder(
      'transfer-pair',
      'out then in',
      `${SECOND_ROW.slice(-4)},${CORNER_SHOP.slice(-4)}`
    ),
    dismissalsOwnedBy(USER, '3'),
  ],
};
