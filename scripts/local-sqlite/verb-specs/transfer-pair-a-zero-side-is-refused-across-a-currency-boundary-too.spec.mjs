import { USER, EVERYDAY, DOLLARS, PAIR_OUT, PAIR_IN, dollarAccount, convertedRows,
  setups, balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  auditRowsInTotal } from './_shared.mjs';

// Zero is neither leaving nor arriving, so it fails the direction rule in both
// currencies and in one.
//
// Worth a spec of its own because of HOW the two rules reach that answer. The
// same-currency rule tests only `v_a.amount = 0` and lets `v_a.amount <>
// -v_b.amount` catch a zero on the far side — `0 <> -0` is false, so the
// negation does the second half of the work. The cross-currency rule has no
// negation in it, so it must test BOTH sides explicitly, and this spec drives
// the SECOND one specifically. An engine that ported the loosening by copying
// the same-currency shape (one zero test, then a sign comparison) would admit a
// pair here: `0.signum()` is neither `1` nor `-1`, so a zero side reads as
// "different sign" and links happily, giving the ledger a transfer that moves
// 30.00 out of one account and nothing into the other.
export default {
  invariant: 'T-1',
  title: 'a zero side is refused across a currency boundary, from the far position',
  design: 'link_transfer_pair 20260812100000 — v_a.amount = 0 OR v_b.amount = 0, both stated, because no negation catches the second',
  consequence: 'money leaves one account and arrives in none, under a link that says the two are one movement',
  parity: 'match',

  setup: setups(dollarAccount, convertedRows({ minor: 0, decimal: '0.00' })),
  command: { verb: 'link_transfer_pair', payload: { id_a: PAIR_OUT, id_b: PAIR_IN, user_id: USER } },
  expect: {
    outcome: 'refused',
    error: 'transfer sides in different currencies must be opposite in sign and non-zero (GBP -30.00 vs USD 0.00)',
  },

  state: [
    transferShape(PAIR_OUT, 'expense:Weekly shop:-:-:-'),
    transferShape(PAIR_IN, 'income:-:-:-:-'),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(DOLLARS, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(DOLLARS),
    auditRowsInTotal('0'),
  ],
};
