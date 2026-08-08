import { USER, STRANGER, EVERYDAY, RAINY_DAY, PAIR_OUT, PAIR_IN, pairableRows, secondUser,
  setups, balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  auditRowsInTotal } from './_shared.mjs';

// X-6, the ownership guard, on a verb that takes TWO rows. `p_user_id` is
// defence in depth on top of RLS in the cloud and the whole gate locally, so a
// call naming somebody else's owner must find nothing at all — and be told the
// same thing it would be told about a row that does not exist, because
// distinguishing them confirms an id exists to a caller who may not see it.
export default {
  invariant: 'X-6',
  title: 'linking rows as a user who does not own them is refused by name',
  design: 'link_transfer_pair 20260716100000:91-100 — (p_user_id IS NULL OR user_id = p_user_id)',
  consequence: 'one login can join two of another login\'s rows into a transfer',
  parity: 'match',

  setup: setups(pairableRows, secondUser),
  command: { verb: 'link_transfer_pair', payload: { id_a: PAIR_OUT, id_b: PAIR_IN, user_id: STRANGER } },
  expect: { outcome: 'refused', error: 'transaction_not_found' },

  state: [
    transferShape(PAIR_OUT, 'expense:Weekly shop:-:-:-'),
    transferShape(PAIR_IN, 'income:-:-:-:-'),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(RAINY_DAY, '30.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
