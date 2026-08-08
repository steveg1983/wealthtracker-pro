import {
  USER, STRANGER, EVERYDAY, CORNER_SHOP, WEEKLY_SHOP, OUTGOINGS,
  secondUser, balanceOf, balanceIdentityHolds, splitLines, auditShape, storedFlag,
} from './_shared.mjs';

// REFUSAL 3 of 20 — X-6, the IDOR guard, on the largest write in the schema.
//
// `p_user_id` is defence in depth: RLS already scopes the rows in the cloud, and
// the RPC checks anyway. Locally there is no RLS and the check is the whole of
// it, which is why every verb in this crate carries the same clause.
//
// The refusal is deliberately the SAME for "no such transaction" and "somebody
// else's transaction". Telling them apart would confirm that an id exists to a
// caller who is not allowed to see it — which is the enumeration half of the
// vulnerability the guard exists to close.
export default {
  invariant: 'X-6',
  title: 'splitting a transaction that belongs to somebody else is refused by name',
  design: 'set_transaction_splits_with_legs 20260806094058:168-175 — WHERE id = … AND (p_user_id IS NULL OR user_id = p_user_id)',
  consequence: 'one signed-in user can re-file, re-total and move the balance of another user\'s transaction',
  parity: 'match',

  setup: secondUser,

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: STRANGER,
      expected_amount: '-25.00',
      splits: [
        { category: WEEKLY_SHOP, amount: '-15.00' },
        { category: OUTGOINGS, amount: '-10.00' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'transaction_not_found' },

  state: [
    splitLines(CORNER_SHOP, 'NONE'),
    storedFlag(CORNER_SHOP, 'is_split', 'no'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    auditShape('NONE'),
  ],
};
