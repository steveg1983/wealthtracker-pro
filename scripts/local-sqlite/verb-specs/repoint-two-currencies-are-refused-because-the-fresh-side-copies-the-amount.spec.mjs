import {
  USER, EVERYDAY, RAINY_DAY, DOLLARS, OTHER_LEG, THIS_LEG,
  auditRowsInTotal, balanceOf, balanceIdentityHolds, dollarAccount, setups, transferPair,
  transferShape,
} from './_shared.mjs';

// The same guard create_transfer_counterpart applies, for the same reason and in
// the same words: the two sides of a transfer are exact negations with no
// conversion, so a pair straddling two currencies is arithmetic nonsense. It
// bites here even on `move`, where no row is minted — because the PAIR would end
// up straddling, whichever disposition put it there.
export default {
  invariant: 'T-9',
  title: 'a re-point into another currency is refused, and nothing moves',
  design: 'repoint_transfer 20260810140000:204-210 — the cross-currency guard, applied before the first write',
  consequence: 'a foreign amount moves a ledger by its raw magnitude and the account is wrong by the exchange rate forever',
  parity: 'match',

  setup: setups(transferPair, dollarAccount),
  command: {
    verb: 'repoint_transfer',
    payload: { id: OTHER_LEG, target_account_id: DOLLARS, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'different currencies are not supported yet' },

  state: [
    transferShape(OTHER_LEG, 'transfer:-:0002:0005:-'),
    transferShape(THIS_LEG, 'transfer:-:0001:0004:-'),
    balanceOf(EVERYDAY, '-40.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceOf(DOLLARS, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    balanceIdentityHolds(DOLLARS),
    auditRowsInTotal('0'),
  ],
};
