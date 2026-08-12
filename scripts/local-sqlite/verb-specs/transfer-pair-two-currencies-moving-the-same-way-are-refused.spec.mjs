import { USER, EVERYDAY, DOLLARS, PAIR_OUT, PAIR_IN, dollarAccount, convertedRows,
  setups, balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  auditRowsInTotal } from './_shared.mjs';

// The floor under the 2026-08-12 loosening, and the reason it is a loosening
// rather than a removal.
//
// Across a currency boundary the engine gives up its opinion about MAGNITUDE —
// the ratio between the two figures is the achieved rate, and no engine can
// know what it should have been. It does not give up its opinion about
// DIRECTION. A transfer is one movement seen from both ends: one account goes
// down, the other goes up. Two sides that both fall are two spends that happen
// to be near each other, and calling them a transfer would net −30.00 and
// −38.00 into a movement of nothing while both accounts really did lose money.
//
// This is the assertion that would fail if an engine ported the loosening as
// "stop checking the amounts", which is the plausible wrong reading of it.
export default {
  invariant: 'T-1',
  title: 'two sides in different currencies that both move the same way are refused',
  design: 'link_transfer_pair 20260812100000 — sign(v_a.amount) = sign(v_b.amount) across a currency boundary',
  consequence: 'two separate spends are recorded as one movement, so both accounts show money leaving and the ledger shows none of it going anywhere',
  parity: 'match',

  setup: setups(dollarAccount, convertedRows({ minor: -3800, decimal: '-38.00' }), {
    // The row arrived as an 'income' from the fixture; a negative income is a
    // shape no importer writes, and the refusal must not depend on the type.
    sqlite: `UPDATE transactions SET type = 'expense' WHERE id = '${PAIR_IN}';`,
    postgres: `UPDATE public.transactions SET type = 'expense' WHERE id = '${PAIR_IN}';`,
  }),
  command: { verb: 'link_transfer_pair', payload: { id_a: PAIR_OUT, id_b: PAIR_IN, user_id: USER } },
  expect: {
    outcome: 'refused',
    error: 'transfer sides in different currencies must be opposite in sign and non-zero (GBP -30.00 vs USD -38.00)',
  },

  state: [
    transferShape(PAIR_OUT, 'expense:Weekly shop:-:-:-'),
    transferShape(PAIR_IN, 'expense:-:-:-:-'),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(DOLLARS, '-38.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(DOLLARS),
    auditRowsInTotal('0'),
  ],
};
