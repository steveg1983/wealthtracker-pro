import { USER, EVERYDAY, CORNER_SHOP,
  balanceOf, balanceIdentityHolds, rowsInAccount, transferShape, auditRowsInTotal } from './_shared.mjs';

// T-2. Minting the negation into the SAME account would leave that account's
// balance exactly where it started while adding two rows to its register — a
// pair of entries that cancel, look like a transfer, and describe nothing.
export default {
  invariant: 'T-2',
  title: 'a counterpart cannot be minted into the account the row is already in',
  design: 'create_transfer_counterpart 20260721090000:51-53',
  consequence: 'two rows that cancel each other appear in one register and claim to be a transfer',
  parity: 'match',

  command: {
    verb: 'create_transfer_counterpart',
    payload: { id: CORNER_SHOP, target_account_id: EVERYDAY, user_id: USER },
  },
  expect: { outcome: 'refused', error: 'a transfer needs two different accounts' },

  state: [
    transferShape(CORNER_SHOP, 'expense:Weekly shop:-:-:-'),
    rowsInAccount(EVERYDAY, '1'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    auditRowsInTotal('0'),
  ],
};
