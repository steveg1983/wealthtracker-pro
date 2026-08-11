import {
  USER, EVERYDAY, RAINY_DAY, HOLIDAY_FUND, OTHER_LEG, THIS_LEG,
  auditRowsInTotal, balanceOf, balanceIdentityHolds, setups, thirdAccount, transferPair,
  transferShape,
} from './_shared.mjs';

// The stale-list guard. A client holding a page loaded before somebody else
// unpicked the pair would otherwise re-point one half of a transfer whose other
// half has moved on — and the money statement would follow the wrong row.
export default {
  invariant: 'T-7',
  title: 'two rows that no longer name each other cannot be re-pointed',
  design: 'repoint_transfer 20260810140000:186-190 — the mutual check repair_claimed_transfer makes, in a verb that MOVES money',
  consequence: 'a re-point driven off a stale list moves an amount out of an account on the strength of a link that is gone',
  parity: 'match',

  setup: {
    sqlite: `${setups(transferPair, thirdAccount).sqlite}
    UPDATE transactions SET linked_transfer_id = NULL WHERE id = '${THIS_LEG}';`,
    postgres: `${setups(transferPair, thirdAccount).postgres}
    UPDATE public.transactions SET linked_transfer_id = NULL WHERE id = '${THIS_LEG}';`,
  },
  command: {
    verb: 'repoint_transfer',
    payload: { id: OTHER_LEG, target_account_id: HOLIDAY_FUND, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'not linked to each other any more' },

  state: [
    transferShape(OTHER_LEG, 'transfer:-:0002:0005:-'),
    transferShape(THIS_LEG, 'transfer:-:0001:-:-'),
    balanceOf(EVERYDAY, '-40.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceOf(HOLIDAY_FUND, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    balanceIdentityHolds(HOLIDAY_FUND),
    auditRowsInTotal('0'),
  ],
};
