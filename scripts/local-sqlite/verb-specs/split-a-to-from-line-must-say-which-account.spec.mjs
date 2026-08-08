import {
  USER, EVERYDAY, CORNER_SHOP, WEEKLY_SHOP, TO_FROM_RAINY_DAY,
  namedTransferCategories, balanceOf, balanceIdentityHolds, splitLines, auditShape, storedFlag,
} from './_shared.mjs';

// REFUSAL 12 of 20 — S-8's first half.
//
// A To/From category IS the sentence "this line is a transfer". Filing a line
// under one without naming the account on the other side describes a transfer to
// nowhere: no counterpart can be made, nothing is linked, and the line sits in
// the register claiming to be half of something that does not exist. The report
// then shows a transfer to an account that never received it.
//
// The converse is deliberately NOT required, and the RPC says why (`:297-301`):
// the MS Money importer filed 86 legs under the "Unassigned" bucket where the
// To/From category was missing, so demanding a To/From category on every leg
// would make exactly the splits this migration exists to unblock uneditable
// again. `split-a-line-that-becomes-a-leg-gets-its-other-side-made.spec.mjs`
// proves that direction.
//
// Naming a To/From category in a payload takes a fixture of its own: both
// engines mint them from a trigger with a generated id, so the setup renames
// them to something a spec can say. See `namedTransferCategories`.
export default {
  invariant: 'S-8',
  title: 'a line filed under a To/From category must say which account is on the other side',
  design: 'set_transaction_splits_with_legs 20260806094058:287-291',
  consequence: 'a "transfer" with no other side: nothing to link, nothing to reconcile, and a report naming an account that never received the money',
  parity: 'match',

  setup: namedTransferCategories,

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      expected_amount: '-25.00',
      splits: [
        // Filed as a transfer to Rainy day, but not declared as one.
        { category: TO_FROM_RAINY_DAY, amount: '-15.00' },
        { category: WEEKLY_SHOP, amount: '-10.00' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'split_leg_not_declared' },

  state: [
    splitLines(CORNER_SHOP, 'NONE'),
    storedFlag(CORNER_SHOP, 'is_split', 'no'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    auditShape('NONE'),
  ],
};
