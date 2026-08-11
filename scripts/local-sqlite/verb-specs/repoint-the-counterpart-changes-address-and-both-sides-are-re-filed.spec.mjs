import {
  USER, EVERYDAY, RAINY_DAY, HOLIDAY_FUND, OTHER_LEG, THIS_LEG,
  balanceOf, balanceIdentityHolds, rowsInAccount, setups, thirdAccount, transferPair,
  transferShape,
} from './_shared.mjs';

// THE happy path, and the one that fixes what a re-point MEANS: the counterpart
// changes address, the money goes with the row, and BOTH sides are re-filed from
// the pairing as it will be. The crossover is the assertion — each row's
// category names the OTHER side — because a port that patched whichever side
// visibly changed would leave the counterpart filed under the To/From category
// of an account this transfer has nothing to do with any more.
export default {
  invariant: 'T-6',
  title: 'a re-point moves the counterpart, and each side is filed under the OTHER account',
  design: 'repoint_transfer 20260810140000:212-243 — the crossover, derived from the new pairing on both rows rather than patched on one',
  consequence: 'a transfer whose two halves name different accounts is a transfer the picker offers twice and the reports count once',
  parity: 'match',

  setup: setups(transferPair, thirdAccount),
  command: {
    verb: 'repoint_transfer',
    payload: { id: OTHER_LEG, target_account_id: HOLIDAY_FUND, user_id: USER },
  },
  expect: { outcome: 'ok' },

  // A To/From category's id is minted by a trigger on BOTH engines and is
  // unknowable at authoring time on either, so the projected row cannot be
  // compared on it. The state assertions compare it by NAME instead, which is
  // the half that carries the crossover rule.
  rowDivergence: {
    category: 'a To/From category\'s id is minted by a trigger on both engines and is unknowable at authoring time on either — the state assertions compare it by NAME instead',
  },

  state: [
    // The edited row: still in Everyday, now facing Holiday fund and filed under
    // Holiday fund's To/From category.
    transferShape(OTHER_LEG, 'transfer:To/From Holiday fund:0003:0005:-'),
    // The counterpart: now IN Holiday fund, facing Everyday, filed under
    // EVERYDAY's To/From category. That is the crossover.
    transferShape(THIS_LEG, 'transfer:To/From Everyday:0001:0004:-'),

    // The money moved with the row: Rainy day is down 15.00, Holiday fund up.
    balanceOf(EVERYDAY, '-40.00'),
    balanceOf(RAINY_DAY, '0.00'),
    balanceOf(HOLIDAY_FUND, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    balanceIdentityHolds(HOLIDAY_FUND),
    rowsInAccount(RAINY_DAY, '0'),
    rowsInAccount(HOLIDAY_FUND, '1'),
  ],
};
