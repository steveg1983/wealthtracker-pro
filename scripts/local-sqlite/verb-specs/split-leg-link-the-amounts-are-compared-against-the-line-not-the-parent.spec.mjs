import { USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, LEG_LINE, MATCHING,
  splitWithAnUnlinkedLeg, matchingRow, setups,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, legPairsAreMutual,
  auditRowsInTotal } from './_shared.mjs';

// T-10 — DESIGN.md calls it *"the single most-likely-to-be-mis-ported rule in
// the whole schema"* — driven from the failing side.
//
// The split parent is −25.00 and the leg LINE is −15.00. A row of +25.00 matches
// the PARENT exactly and matches the LINE not at all, so a port that compared
// against the parent would ACCEPT this payload and pair a +25.00 row with a
// −15.00 line: ten pounds appearing out of nowhere between two accounts, with
// both engines' balance identities still holding on each account separately.
//
// The refusal names both figures, and the second one is the LINE's — which is
// how a reader can tell which side of the rule fired.
export default {
  invariant: 'T-10',
  title: 'a row matching the parent\'s total but not the line\'s is refused',
  design: 'link_split_line_transfer 20260806094058:580-585 — v_txn.amount <> -v_line.amount, never the parent',
  consequence: 'the difference between the parent and the line appears from nowhere in the other account, and B-1 goes on holding on both accounts while the ledger as a whole is wrong',
  parity: 'match',

  setup: setups(splitWithAnUnlinkedLeg, {
    sqlite: `${matchingRow.sqlite}
      UPDATE transactions SET amount_minor = 2500 WHERE id = '${MATCHING}';
      UPDATE accounts SET balance_minor = balance_minor + 1000 WHERE id = '${RAINY_DAY}';`,
    postgres: `${matchingRow.postgres}
      UPDATE public.transactions SET amount = 25.00 WHERE id = '${MATCHING}';
      UPDATE public.accounts SET balance = balance + 10.00 WHERE id = '${RAINY_DAY}';`,
  }),
  command: {
    verb: 'link_split_line_transfer',
    payload: { split_id: LEG_LINE, transaction_id: MATCHING, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'transfer sides must have exactly opposite non-zero amounts (25.00 vs -15.00)' },

  state: [
    splitLines(CORNER_SHOP, '0:-15.00:Weekly shop:0002:-:- | 1:-10.00:Weekly shop:-:-:-'),
    splitSumHolds(CORNER_SHOP),
    legPairsAreMutual(),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '25.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
