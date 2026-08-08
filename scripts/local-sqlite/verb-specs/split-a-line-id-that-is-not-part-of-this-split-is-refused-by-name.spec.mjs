import {
  USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, WEEKLY_SHOP, LEG_LINE, PLAIN_LINE,
  setups, namedTransferCategories, splitWithTransferLeg, TO_FROM_RAINY_DAY,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, auditShape, splitLineState,
} from './_shared.mjs';

// REFUSAL 14 of 20 — S-11's second half, and the stale-tab guard.
//
// The scenario is ordinary: a split is open in two places, one of them saves,
// and the other saves a line set that still mentions a line the first save
// deleted. Without this check the id would match nothing, the UPDATE would touch
// zero rows, SQLite would say nothing at all, and the line would quietly become
// a new one — a duplicate of money the other tab had already re-filed.
//
// The lookup is scoped to THIS split (`AND transaction_id = p_transaction_id`),
// so naming another split's line is refused too, rather than stealing it.
//
// Ids are compared as TEXT on both engines, which is the cloud's own decision
// (`:181-184`): "a malformed id from a confused caller resolves to no row and
// gets a sentence rather than a raw 22P02 cast error". The id below is
// well-formed and simply not here, but the same path handles both.
export default {
  invariant: 'S-11',
  title: 'a line id that is not part of this split is refused rather than quietly becoming a new line',
  design: 'set_transaction_splits_with_legs 20260806094058:303-309 — the stored-line lookup, scoped to this parent',
  consequence: 'a stale tab re-inserts a line another save already removed, and the split silently gains a duplicate',
  parity: 'match',

  setup: setups(namedTransferCategories, splitWithTransferLeg),

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      splits: [
        { id: LEG_LINE, category: TO_FROM_RAINY_DAY, amount: '-15.00', transfer_account_id: RAINY_DAY },
        { id: '50000000-0000-0000-0000-0000000000ff', category: WEEKLY_SHOP, amount: '-10.00' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'split_line_not_found' },

  state: [
    // The whole edit is undone, including the first line, which was perfectly
    // valid and had already been written by the time the second was read.
    splitLines(
      CORNER_SHOP,
      '0:-15.00:To/From Rainy day:0002:linked:- | 1:-10.00:Weekly shop:-:-:-',
    ),
    splitLineState(LEG_LINE, 'linked'),
    splitLineState(PLAIN_LINE, 'unlinked'),
    splitSumHolds(CORNER_SHOP),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditShape('NONE'),
  ],
};
