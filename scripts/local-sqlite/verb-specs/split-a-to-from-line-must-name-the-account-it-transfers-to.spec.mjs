import {
  USER, EVERYDAY, RAINY_DAY, HOLIDAY_FUND, CORNER_SHOP, WEEKLY_SHOP, TO_FROM_RAINY_DAY,
  setups, namedTransferCategories, thirdAccount,
  balanceOf, balanceIdentityHolds, splitLines, auditShape, storedFlag, rowsIn,
} from './_shared.mjs';

// REFUSAL 13 of 20 — S-8's second half, and the one that is genuinely hard to
// spot by reading a register.
//
// The line below is filed under "To/From Rainy day" and transfers to Holiday
// fund. Both halves are individually valid: the category exists, the account
// exists and belongs to the user, the amounts are fine. The pair is a lie, and
// the lie is invisible in every place the two are shown separately — the
// register shows the target, the category report shows the filing, and they
// disagree with each other in a way only a query that looks at both would find.
//
// The RPC's rule is exact: a To/From category "must name the same account the
// line does". Not "an account". The same one.
export default {
  invariant: 'S-8',
  title: 'a line filed under one account\'s To/From category cannot transfer to a different account',
  design: 'set_transaction_splits_with_legs 20260806094058:292-295 — v_cat.account_id IS DISTINCT FROM v_target',
  consequence: 'the register and the category report name two different accounts for one movement of money, and neither is wrong on its own',
  parity: 'match',

  setup: setups(namedTransferCategories, thirdAccount),

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      expected_amount: '-25.00',
      splits: [
        { category: TO_FROM_RAINY_DAY, amount: '-15.00', transfer_account_id: HOLIDAY_FUND },
        { category: WEEKLY_SHOP, amount: '-10.00' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'split_leg_category_mismatch' },

  state: [
    splitLines(CORNER_SHOP, 'NONE'),
    storedFlag(CORNER_SHOP, 'is_split', 'no'),
    rowsIn(HOLIDAY_FUND, 'NONE'),
    rowsIn(RAINY_DAY, 'NONE'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(HOLIDAY_FUND, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(HOLIDAY_FUND),
    auditShape('NONE'),
  ],
};
