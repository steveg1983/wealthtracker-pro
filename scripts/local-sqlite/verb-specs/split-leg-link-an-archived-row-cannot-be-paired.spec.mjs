import { USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, LEG_LINE, MATCHING,
  splitWithAnUnlinkedLeg, matchingRow, setups,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, legPairsAreMutual,
  storedFlag, auditRowsInTotal } from './_shared.mjs';

// T-13, in this verb's own wording — *"that row is archived"*, singular, where
// `repair_claimed_transfer` says *"one of these rows"* because it has three to
// choose from. Same code, different sentence, and the difference is the cloud's
// and is reproduced rather than harmonised: the client shows `error.message` to
// a human and "one of these rows" in front of a single row is a worse sentence.
export default {
  invariant: 'T-13',
  title: 'an archived row cannot be taken as a leg\'s other side',
  design: 'link_split_line_transfer 20260806094058:568-571',
  consequence: 'a row the user cannot see is silently re-typed and linked into a split they are looking at',
  parity: 'match',

  setup: setups(splitWithAnUnlinkedLeg, matchingRow, {
    sqlite: `UPDATE transactions SET archived = 1 WHERE id = '${MATCHING}';`,
    postgres: `UPDATE public.transactions SET archived = true WHERE id = '${MATCHING}';`,
  }),
  command: {
    verb: 'link_split_line_transfer',
    payload: { split_id: LEG_LINE, transaction_id: MATCHING, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'archived_row_not_repairable' },

  state: [
    storedFlag(MATCHING, 'archived', 'yes'),
    splitLines(CORNER_SHOP, '0:-15.00:Weekly shop:0002:-:- | 1:-10.00:Weekly shop:-:-:-'),
    splitSumHolds(CORNER_SHOP),
    legPairsAreMutual(),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
