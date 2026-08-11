import {
  USER, NEW_ACCOUNT,
  accountText, balanceIdentityHolds, writeInstants,
} from './_shared.mjs';

// The cloud's writer sends `openingBalanceDate.toISOString()` into a DATE
// column, which truncates. This file's column is TEXT with a shape CHECK, so the
// truncation is the verb's — and the stored day has to come out the same.
export default {
  invariant: 'D-8',
  title: 'an ISO instant for an opening balance date is stored as the day, on both engines',
  design: 'accountService.createAccount:256-258 sends `openingBalanceDate instanceof Date ? .toISOString() : …`; Postgres’s ::date truncates and create_account splits on the ISO separator',
  consequence: 'a full timestamp reaching a TEXT column with `LIKE \'____-__-__\'` is a refused create where the cloud stores the day — an account the desktop cannot make and the web can',
  parity: 'match',

  command: {
    verb: 'create_account',
    payload: {
      id: NEW_ACCOUNT,
      user_id: USER,
      name: 'Rainy day',
      opening_balance_date: '2024-04-06T12:00:00.000Z',
    },
  },

  expect: { outcome: 'ok' },
  rowDivergence: writeInstants,
  result: { opening_balance_date: '2024-04-06' },

  state: [
    accountText(NEW_ACCOUNT, 'opening_balance_date', '2024-04-06'),
    balanceIdentityHolds(NEW_ACCOUNT),
  ],
};
