import { USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, PAIR_OUT, pairableRows,
  balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  auditRowsInTotal } from './_shared.mjs';

// T-2, and it beats T-1: this payload ALSO has amounts that are not opposite
// (−30.00 and −25.00), and MEASURED (probe-transfers.sh,
// `ltp-same-account-beats-amounts`) the account check wins. A port that
// validated the money first — the more "fundamental" rule — would show the user
// a different sentence for the same mistake.
export default {
  invariant: 'T-2',
  title: 'a transfer needs two different accounts, and that is checked before the amounts',
  design: 'link_transfer_pair 20260716100000:105-107, before :108-111',
  consequence: 'money "transfers" inside one account: two rows, one balance, nothing moved',
  parity: 'match',

  setup: pairableRows,
  command: { verb: 'link_transfer_pair', payload: { id_a: PAIR_OUT, id_b: CORNER_SHOP, user_id: USER } },
  expect: { outcome: 'refused', error: 'a transfer needs two different accounts' },

  state: [
    transferShape(PAIR_OUT, 'expense:Weekly shop:-:-:-'),
    transferShape(CORNER_SHOP, 'expense:Weekly shop:-:-:-'),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(RAINY_DAY, '30.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
