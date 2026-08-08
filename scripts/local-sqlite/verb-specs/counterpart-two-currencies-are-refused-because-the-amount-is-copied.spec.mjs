import { USER, EVERYDAY, DOLLARS, CORNER_SHOP, dollarAccount,
  balanceOf, balanceIdentityHolds, rowsInAccount, transferShape, auditRowsInTotal } from './_shared.mjs';

// T-9, and the contrast with `link_transfer_pair` is the whole point: THIS verb
// copies an amount into another ledger with no conversion, so a −25.00 GBP row
// would move a USD account by 25.00 USD. `20260721090000`'s header names the
// real figure it was written for: *"a USD −$1,336.25 source would move a GBP
// account by £1,336.25"*.
//
// `link_transfer_pair` has no such guard and does not need one — it converts
// nothing — and that asymmetry is pinned by
// `transfer-pair-two-currencies-are-linked-because-nothing-is-converted`.
export default {
  invariant: 'T-9',
  title: 'a counterpart in another currency is refused, because the amount would be copied unconverted',
  design: 'create_transfer_counterpart 20260721090000:63-74 — the guard this migration exists to add',
  consequence: 'a foreign amount moves a ledger by its raw magnitude and the account is wrong by the exchange rate forever',
  parity: 'match',

  setup: dollarAccount,
  command: {
    verb: 'create_transfer_counterpart',
    payload: { id: CORNER_SHOP, target_account_id: DOLLARS, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'Transfers between accounts in different currencies are not supported yet (GBP and USD)' },

  state: [
    transferShape(CORNER_SHOP, 'expense:Weekly shop:-:-:-'),
    rowsInAccount(DOLLARS, '0'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(DOLLARS, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(DOLLARS),
    auditRowsInTotal('0'),
  ],
};
