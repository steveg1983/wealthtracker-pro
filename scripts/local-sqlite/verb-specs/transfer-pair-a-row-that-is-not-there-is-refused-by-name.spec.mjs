import { USER, EVERYDAY, RAINY_DAY, PAIR_IN, pairableRows,
  balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  auditRowsInTotal } from './_shared.mjs';

// Both engines refuse an id nobody has with the same name, and — the half that
// matters more — leave the row that WAS there completely alone. A verb that
// linked one side before checking the other would leave a one-sided transfer
// behind on every fat-fingered call.
export default {
  invariant: 'X-6',
  title: 'linking to a row that does not exist refuses and writes nothing',
  design: 'link_transfer_pair 20260716100000:91-100 — SELECT … IF NOT FOUND, once per side',
  consequence: 'half a pair is written and the survivor points at a row that never existed',
  parity: 'match',

  setup: pairableRows,
  command: {
    verb: 'link_transfer_pair',
    payload: { id_a: '70000000-0000-0000-0000-0000000000ff', id_b: PAIR_IN, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'transaction_not_found' },

  state: [
    transferShape(PAIR_IN, 'income:-:-:-:-'),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(RAINY_DAY, '30.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
