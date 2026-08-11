import {
  USER, CORNER_SHOP, NEW_DISMISSAL,
  auditRowsInTotal, auditTrailFor, dismissalsOwnedBy,
} from './_shared.mjs';

// THE ONE FAMILY IN THIS CRATE THAT AGREES WITH THE CLOUD ABOUT THE AUDIT LOG,
// and the agreement is argued rather than inherited.
//
// Divergence 10 (create_budget) made the planning verbs audit two tables the
// cloud audits NOWHERE, because money lives in four of their columns. That
// argument does not reach here and the difference is not that a dismissal
// matters less — it is that the trail answers a question a dismissal is not part
// of. 20260806180000:75-79, verbatim:
//
//   financial_audit_log answers "what happened to this money, and who did it".
//   A dismissal touches no money: no amount, no sign, no account, no category,
//   no link. Writing it into the financial audit trail would dilute the artifact
//   that compliance actually depends on.
//
// So U-1 — "the write cannot succeed without its audit entry" — is a rule about
// AUDITED operations and does not apply. The absence is asserted rather than
// assumed, because an absence nobody measures is an absence nobody would notice
// becoming a presence.
export default {
  invariant: 'U-1',
  title: 'a refusal writes no line in the money trail, on either engine',
  design: '20260806180000:73-79 argues it on the merits, and the service header repeats it: "why it writes no financial audit entry". Set against DESIGN.md §5 divergence 10, where this crate audits budgets and goals precisely BECAUSE money lives in their columns',
  consequence: 'a trail padded with rows that changed no figure is a trail somebody has to read past to find the one that did. The dismissal table already records what needs recording — dismissed_at says when, and the row is scoped to one owner',
  parity: 'match',

  command: {
    verb: 'dismiss_suggestion',
    payload: {
      id: NEW_DISMISSAL,
      user_id: USER,
      kind: 'duplicate',
      subject_key: 'nothing to declare',
      subject_ids: [CORNER_SHOP],
    },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    dismissed_at: 'the instant of the write, on two clocks and in two transactions',
  },

  state: [
    dismissalsOwnedBy(USER, '1'),
    // Not one row, anywhere in the trail — a verb that audited under some other
    // entity name would pass a probe scoped to 'dismissal' and fail this.
    auditRowsInTotal('0'),
    auditTrailFor('dismissal', 'NONE'),
  ],
};
