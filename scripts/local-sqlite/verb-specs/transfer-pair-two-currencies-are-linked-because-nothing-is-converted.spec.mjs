import { USER, EVERYDAY, DOLLARS, PAIR_OUT, PAIR_IN, dollarAccount, convertedRows,
  setups, balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  auditShape } from './_shared.mjs';

// The second DELIBERATE ABSENCE, and this one has a reason rather than being an
// oversight. T-9 refuses a cross-currency COUNTERPART (`20260721090000`)
// because that RPC copies an amount into another ledger with no conversion.
//
// Joining two rows that already exist copies nothing. Each side already counts
// against its own account in its own currency, and the link only says they are
// one movement. So there is nothing to convert and nothing to refuse.
//
// ── DECLARED BEHAVIOUR CHANGE, 2026-08-12 ───────────────────────────────────
//
// This spec used to prove that claim with a pair of ±30.00, and it proved
// nothing. A pair that sums to zero passes the strict rule and the loosened one
// alike; ±30.00 across a currency boundary is a rate of exactly 1, which is not
// a shape any conversion produces. Meanwhile refusal 5 — `v_a.amount <>
// -v_b.amount`, applied unconditionally — refused every pair that WAS a
// conversion. The suite therefore certified "different currencies are linked"
// while the engine refused all of them, for a year, and the fixture is the
// reason nobody noticed.
//
// The rule changed in all three engines at once (this is a `match`, not a
// divergence): across a currency boundary the two sides must be non-zero and
// OPPOSITE IN SIGN, with no constraint on magnitude, because the ratio between
// the magnitudes IS the achieved rate and no engine has an opinion about FX.
// Cloud side: `20260812100000_transfer_linking_across_currencies.sql`.
//
// The fixture now differs on both sides of the boundary — −30.00 GBP against
// +38.00 USD — so it can only pass under the new rule. Both balances are
// asserted below in their own currencies, which is what makes this a proof
// rather than an assertion: neither ledger moved, so neither was converted.
export default {
  invariant: 'T-9',
  title: 'two accounts in different currencies are linked at a real rate, because a link converts nothing',
  design: 'link_transfer_pair 20260812100000 — refusal 5 splits on currency; contrast create_transfer_counterpart 20260721090000:63-74, which still refuses outright because it COPIES an amount',
  consequence: 'either every legitimate cross-currency pairing is refused — as it was until 2026-08-12, while 70 importer-written pairs sat in the ledger proving the rule wrong — or a raw magnitude is copied into the wrong ledger',
  parity: 'match',

  setup: setups(dollarAccount, convertedRows({ minor: 3800, decimal: '38.00' })),
  command: { verb: 'link_transfer_pair', payload: { id_a: PAIR_OUT, id_b: PAIR_IN, user_id: USER } },
  expect: { outcome: 'ok' },
  result: { id: PAIR_OUT, amount: '-30.00', type: 'transfer' },

  rowDivergence: {
    category: 'a To/From category\'s id is minted by a trigger on both engines and is unknowable at authoring time on either — the state assertions compare it by NAME instead',
  },

  state: [
    transferShape(PAIR_OUT, `transfer:To/From Dollars:000d:${PAIR_IN.slice(-4)}:-`),
    transferShape(PAIR_IN, `transfer:To/From Everyday:0001:${PAIR_OUT.slice(-4)}:-`),
    transferLinksAreMutual(),
    // Neither figure is the other converted, and neither moved. That is the
    // whole property: a link is balance-neutral in two currencies exactly as
    // it is in one.
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(DOLLARS, '38.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(DOLLARS),
    auditShape('transaction/update,transaction/update'),
  ],
};
