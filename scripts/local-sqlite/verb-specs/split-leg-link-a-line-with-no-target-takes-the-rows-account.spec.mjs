import { USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, LEG_LINE, MATCHING,
  splitWithAnUnlinkedLeg, matchingRow, setups,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, legPairsAreMutual,
  transferShape, auditShape } from './_shared.mjs';

// An ordinary line — no `transfer_account_id` at all — can become a leg, and it
// takes the account from the row it is paired with. The target check is
// `IS NOT NULL AND IS DISTINCT FROM`, so a line with no target has nothing to
// contradict.
//
// This is not a corner case: it is how a user says "this part of that shop trip
// was actually money moving to savings" about a split they filed months ago,
// which is the whole population `20260806094058` was written for. MEASURED
// (probe-transfers3.sh, `lsl-line-no-target`).
//
// Note what does NOT change: the line keeps its ordinary category (Weekly shop).
// The RPC files the ROW under a To/From category and leaves the LINE's filing
// alone, because the importer's legs are filed under ordinary categories and
// re-filing them here would be the split writer's job, not this verb's.
export default {
  invariant: 'S-8',
  title: 'a line with no target takes the account of the row it is paired with',
  design: 'link_split_line_transfer 20260806094058:575-579 — IS NOT NULL AND IS DISTINCT FROM, not a bare mismatch',
  consequence: 'an ordinary split line can never be recognised as a transfer leg, and every such correction has to go through a full re-save of the split',
  parity: 'match',

  setup: setups(splitWithAnUnlinkedLeg, matchingRow, {
    sqlite: `UPDATE transaction_splits SET transfer_account_id = NULL WHERE id = '${LEG_LINE}';`,
    postgres: `UPDATE public.transaction_splits SET transfer_account_id = NULL WHERE id = '${LEG_LINE}';`,
  }),
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
    legPairsAreMutual(),
    splitSumHolds(CORNER_SHOP),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditShape('transaction/update,transaction/update'),
  ],
};
