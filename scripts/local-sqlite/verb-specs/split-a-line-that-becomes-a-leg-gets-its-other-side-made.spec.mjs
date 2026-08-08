import {
  USER, EVERYDAY, RAINY_DAY, WEEKLY_SHOP, CORNER_SHOP,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, legPairsAreMutual,
  auditShape, rowsIn,
} from './_shared.mjs';

// THE CENTRAL BEHAVIOUR OF THIS VERB. Before 20260806094058 nobody could say
// "one line of this split is money moving to another account": the strict writer
// refuses a To/From category outright and there was no other way in. 86 of the
// owner's 364 leg lines exist only because the MS Money importer wrote them
// directly.
//
// What "made" means, precisely, and every part of it is asserted below:
//
//   * the counterpart is the exact opposite of the LINE (+15.00), never of the
//     PARENT (-25.00). The parent's total includes the other lines and is
//     SUPPOSED to differ — that difference is the whole point of a mixed split;
//   * it files under the OTHER account's To/From category (T-6), so it reads as
//     "To/From Everyday" while sitting in Rainy day;
//   * it carries the parent's description and date, the LINE's memo where there
//     is one, and is not cleared;
//   * it points back at both the parent and the exact line, and the line points
//     at it (T-11) — which is what makes the pair navigable from either end;
//   * Rainy day's balance moves by exactly the counterpart's amount, and
//     Everyday's does not move at all, because the line total did not change.
//
// Note the line is filed under an ORDINARY category. That is deliberate and it
// is the case the migration exists for: the RPC does not require a leg to carry
// a To/From category, because the imported ones do not.
export default {
  invariant: 'T-10',
  title: 'a line that names a transfer account gets a real counterpart in that account',
  design: 'set_transaction_splits_with_legs 20260806094058:359-418 — mint, link, move that account\'s balance, audit both',
  consequence: 'the Money answer — "part of this went to another account" — cannot be said at all, and the 78 split parents that already contain a leg stay uneditable',
  parity: 'match',

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      expected_amount: '-25.00',
      splits: [
        { category: WEEKLY_SHOP, amount: '-15.00', transfer_account_id: RAINY_DAY, memo: 'to savings' },
        { category: WEEKLY_SHOP, amount: '-10.00' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { id: CORNER_SHOP, amount: '-25.00', is_split: true },

  state: [
    splitLines(
      CORNER_SHOP,
      '1:-15.00:Weekly shop:0002:linked:to savings | 2:-10.00:Weekly shop:-:-:-',
    ),
    // The counterpart, in full, without naming the uuid neither engine can agree
    // on: amount, type, category NAME, description, notes, cleared, and the fact
    // that it is a leg of a split rather than an ordinary linked transfer.
    rowsIn(RAINY_DAY, '15.00:transfer:To/From Everyday:Corner shop:to savings:uncleared:leg-of-a-split'),
    legPairsAreMutual(),
    splitSumHolds(CORNER_SHOP),
    balanceOf(RAINY_DAY, '15.00'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    // Three entities audited for one call: the row that was minted, the account
    // its arrival moved, and the split parent itself.
    auditShape('account/update,transaction/create,transaction/update'),
  ],
};
