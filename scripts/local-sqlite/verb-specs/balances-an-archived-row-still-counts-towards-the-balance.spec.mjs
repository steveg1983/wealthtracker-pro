import {
  USER, EVERYDAY, RAINY_DAY,
  anArchivedRow, derivedBalance, balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'BAL-2',
  title: 'archiving a row hides it and does not spend it: the balance and the count are unchanged',
  design: '20260722160000:15-16, in the RPC\'s own words: "The sum deliberately spans ALL transactions, archived included: archiving is a view flag and never moves a balance." The soft-archive migration is the Microsoft Money lesson written down — Money HARD-DELETED archived rows and the totals went with them',
  consequence: 'THE money bug (R-1, contract rule 82). `AND NOT t.archived` is one token, reads like a tidy-up, and silently removes a user\'s whole archived history from every balance in the app. It would also make verify_integrity report every account with an archived row as broken, because balance_identity does not filter the archive either — which is the sibling check earning its keep',
  parity: 'match',

  setup: anArchivedRow,
  command: { verb: 'account_balances', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    account_balances: [
      // −25.00 and ONE row, both unchanged by the archiving.
      derivedBalance({ account_id: EVERYDAY, balance: '-25.00', txn_count: 1 }),
      derivedBalance({ account_id: RAINY_DAY, balance: '0.00', txn_count: 0 }),
    ],
  },
  state: [
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
