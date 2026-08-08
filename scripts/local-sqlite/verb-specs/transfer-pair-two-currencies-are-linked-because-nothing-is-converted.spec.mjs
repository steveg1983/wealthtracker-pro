import { USER, EVERYDAY, DOLLARS, PAIR_OUT, PAIR_IN, dollarAccount, pairableRows,
  setups, balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  auditShape } from './_shared.mjs';

// The second DELIBERATE ABSENCE, and this one has a reason rather than being an
// oversight. T-9 refuses a cross-currency COUNTERPART
// (`20260721090000`) because that RPC copies an amount into another ledger with
// no conversion, and a USD −1,336.25 would move a GBP account by £1,336.25.
//
// Joining two rows that already exist copies nothing. Each side already counts
// against its own account in its own currency, and the link only says they are
// one movement. So there is nothing to convert and nothing to refuse — MEASURED
// (probe-transfers.sh, `ltp-cross-currency`): the live RPC links them.
//
// Both balances are asserted below in their own currencies, which is what makes
// this spec a proof rather than an assertion: neither ledger moved, so neither
// was converted.
export default {
  invariant: 'T-9',
  title: 'two accounts in different currencies can be linked, because a link converts nothing',
  design: 'link_transfer_pair 20260716100000 — no currency guard; contrast create_transfer_counterpart 20260721090000:63-74',
  consequence: 'either a legitimate cross-currency pairing is refused, or a raw magnitude is copied into the wrong ledger — depending on which side of the line the guard is put',
  parity: 'match',

  setup: setups(dollarAccount, {
    sqlite: `${pairableRows.sqlite}
      UPDATE transactions SET account_id = '${DOLLARS}' WHERE id = '${PAIR_IN}';
      UPDATE accounts SET balance_minor = balance_minor - 3000 WHERE id = 'a0000000-0000-0000-0000-000000000002';
      UPDATE accounts SET balance_minor = balance_minor + 3000 WHERE id = '${DOLLARS}';`,
    postgres: `${pairableRows.postgres}
      UPDATE public.transactions SET account_id = '${DOLLARS}' WHERE id = '${PAIR_IN}';
      UPDATE public.accounts SET balance = balance - 30.00 WHERE id = 'a0000000-0000-0000-0000-000000000002';
      UPDATE public.accounts SET balance = balance + 30.00 WHERE id = '${DOLLARS}';`,
  }),
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
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(DOLLARS, '30.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(DOLLARS),
    auditShape('transaction/update,transaction/update'),
  ],
};
