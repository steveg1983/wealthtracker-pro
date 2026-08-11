import { USER, EVERYDAY, CORNER_SHOP, MARKED_ROW, everyStateOfCommitment,
  storedFlag, auditShape, archivedRowsIn, balanceIdentityHolds } from './_shared.mjs';

// THE OPPOSITE SHAPE FROM THE TICK, in the same schema, and both are ported.
//
// `count(DISTINCT p_ids)` against the rows found and owned: one bad id loses the
// WHOLE call, including the good ids beside it. `set_transactions_cleared` skips
// a bad id in silence. The RPC's own comment says why the pair is right: an
// archive is a decision about a named row, and silently archiving four of five
// would leave the fifth on screen with no explanation.
//
// The good id in this payload is what makes the spec discriminate: a port that
// refused AFTER writing what it could would still name the right refusal, and
// `stored_archived` on CORNER_SHOP is what catches it.
export default {
  invariant: 'A-4',
  title: 'one id nobody has loses the whole call, including the rows beside it',
  design: 'set_transactions_archived 20260805145035:195-204',
  consequence: 'a stale list half-archives a register and reports success',
  parity: 'match',

  setup: everyStateOfCommitment,
  command: {
    verb: 'set_transactions_archived',
    payload: {
      ids: [CORNER_SHOP, '70000000-0000-0000-0000-0000000000ff'],
      archived: true,
      user_id: USER,
    },
  },
  expect: { outcome: 'refused', error: 'transaction_not_found' },

  state: [
    storedFlag(CORNER_SHOP, 'archived', 'no'),
    storedFlag(MARKED_ROW, 'archived', 'no'),
    archivedRowsIn(EVERYDAY, '0'),
    auditShape('NONE'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
