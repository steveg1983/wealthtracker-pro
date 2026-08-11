import {
  USER, EVERYDAY, RAINY_DAY, HOLIDAY_FUND, OTHER_LEG, THIS_LEG,
  balanceOf, balanceIdentityHolds, rowExists, rowsInAccount, setups, thirdAccount,
  transferPair, transferShape,
} from './_shared.mjs';

// The third disposition, and the only one that removes a row. Its balance
// statement is what makes it safe: the removed row's amount comes back off its
// account, and the new counterpart's goes on to the target — two independent,
// audited movements rather than one net figure computed somewhere.
export default {
  invariant: 'B-2',
  title: 'a deleted counterpart takes its amount back out of the account it was in',
  design: 'repoint_transfer 20260810140000:299-325 — the delete branch, which reverses the account it removed the row from',
  consequence: 'a row deleted without reversing its account leaves that balance permanently wrong by its amount',
  parity: 'match',

  setup: setups(transferPair, thirdAccount),
  command: {
    verb: 'repoint_transfer',
    payload: {
      id: OTHER_LEG, target_account_id: HOLIDAY_FUND, disposition: 'delete', user_id: USER,
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
    rowExists(THIS_LEG, '0'),
    rowsInAccount(RAINY_DAY, '0'),
    rowsInAccount(HOLIDAY_FUND, '1'),
    transferShape(OTHER_LEG, 'transfer:To/From Holiday fund:0003:linked:-', { namesIds: false }),

    balanceOf(EVERYDAY, '-40.00'),
    // Back to where it started: the +15.00 row is gone and its effect with it.
    balanceOf(RAINY_DAY, '0.00'),
    balanceOf(HOLIDAY_FUND, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    balanceIdentityHolds(HOLIDAY_FUND),
  ],
};
