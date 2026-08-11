import {
  USER, EVERYDAY, RAINY_DAY, HOLIDAY_FUND, OTHER_LEG, THIS_LEG,
  balanceOf, balanceIdentityHolds, rowsInAccount, setups, storedFlag, thirdAccount,
  transferPair, transferShape,
} from './_shared.mjs';

// The disposition that exists for a counterpart that is a REAL transaction —
// one off a statement that happens to have been matched to this transfer. Moving
// it would drag evidence of one bank's activity into another bank's register, so
// it stays exactly where it is and stops claiming to be half of a transfer.
//
// Balance-neutral for the released row, and that is the point of the branch: it
// does not move and its amount does not change, so its account is untouched. The
// FRESH counterpart is what moves the target.
export default {
  invariant: 'T-6',
  title: 'a released counterpart keeps its place and its money, and asks to be looked at',
  design: 'repoint_transfer 20260810140000:274-296 — the release branch, and needs_review because the row is left in a register the user is not looking at',
  consequence: 'a bank row silently re-filed into another account is imported evidence destroyed to fix a typo',
  parity: 'match',

  setup: setups(transferPair, thirdAccount),
  command: {
    verb: 'repoint_transfer',
    payload: {
      id: OTHER_LEG, target_account_id: HOLIDAY_FUND, disposition: 'release', user_id: USER,
    },
  },
  expect: { outcome: 'ok' },

  // A To/From category's id is minted by a trigger on BOTH engines and is
  // unknowable at authoring time on either, so the projected row cannot be
  // compared on it. The state assertions compare it by NAME instead, which is
  // the half that carries the crossover rule.
  rowDivergence: {
    category: 'a To/From category\'s id is minted by a trigger on both engines and is unknowable at authoring time on either — the state assertions compare it by NAME instead',
    linked_transfer_id: 'the fresh counterpart is minted DURING the call, so its uuid differs per engine and always will — the state assertions compare the FACT of the link instead',
  },

  state: [
    // The released row: same account, same amount, no link, no category, and
    // typed by the money's own direction.
    transferShape(THIS_LEG, 'income:-:-:-:-'),
    storedFlag(THIS_LEG, 'needs_review', 'yes'),
    storedFlag(THIS_LEG, 'category_confirmed', 'yes'),

    // A fresh counterpart in the target, and the source facing it.
    transferShape(OTHER_LEG, 'transfer:To/From Holiday fund:0003:linked:-', { namesIds: false }),
    rowsInAccount(RAINY_DAY, '1'),
    rowsInAccount(HOLIDAY_FUND, '1'),

    balanceOf(EVERYDAY, '-40.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceOf(HOLIDAY_FUND, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    balanceIdentityHolds(HOLIDAY_FUND),
  ],
};
