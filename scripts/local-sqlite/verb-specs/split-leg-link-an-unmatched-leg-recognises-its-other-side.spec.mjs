import { USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, LEG_LINE, MATCHING,
  splitWithAnUnlinkedLeg, matchingRow, setups,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, legPairsAreMutual,
  transferShape, rowsIn, auditShape } from './_shared.mjs';

// THE CENTRAL BEHAVIOUR OF THIS VERB, and the distinction that gives it a reason
// to exist next to the split writer: `set_transaction_splits_with_legs` MINTS a
// counterpart and moves a balance; this RECOGNISES one that is already there and
// moves nothing.
//
// The row in Rainy day was imported by its own bank. Pairing it with the leg:
//
//   * gives the line the account and the row (it was carrying a target and no
//     link — that is what "unmatched" means);
//   * types the row `transfer` and files it under the To/From category of the
//     account the SPLIT sits in (T-6) — it reads "To/From Everyday" while
//     sitting in Rainy day;
//   * points it at BOTH the parent and the exact line, and the line back at it
//     (T-11), which is what makes the pair navigable from either end;
//   * moves NO balance. Both accounts stand exactly where they were, both
//     identities hold, and the audit shape contains no `account/update` at all.
//
// The audit is two entries: the row that changed, and the split PARENT — whose
// own columns are untouched and whose entry differs only in the embedded line
// set (U-4). That is the cloud's own shape, and it is what makes the log say "a
// line of this split became a transfer leg" rather than nothing.
export default {
  invariant: 'T-11',
  title: 'an unmatched leg is paired with the row that was already there, and nothing moves',
  design: 'link_split_line_transfer 20260806094058:587-616 — two UPDATEs, two audit rows, no accounts statement',
  consequence: 'the sweep has no primitive for "that row IS this leg\'s other side", so it duplicates the movement instead of recognising it',
  parity: 'match',

  setup: setups(splitWithAnUnlinkedLeg, matchingRow),
  command: {
    verb: 'link_split_line_transfer',
    payload: { split_id: LEG_LINE, transaction_id: MATCHING, user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { id: MATCHING, amount: '15.00', type: 'transfer' },

  rowDivergence: {
    category: 'a To/From category\'s id is minted by a trigger on both engines and is unknowable at authoring time on either — the state assertions compare it by NAME instead',
  },

  state: [
    splitLines(CORNER_SHOP, '0:-15.00:Weekly shop:0002:linked:- | 1:-10.00:Weekly shop:-:-:-'),
    transferShape(MATCHING, `transfer:To/From Everyday:0001:${CORNER_SHOP.slice(-4)}:${LEG_LINE.slice(-4)}`),
    rowsIn(RAINY_DAY, '15.00:transfer:To/From Everyday:From everyday:-:uncleared:leg-of-a-split'),
    legPairsAreMutual(),
    splitSumHolds(CORNER_SHOP),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditShape('transaction/update,transaction/update'),
  ],
};
