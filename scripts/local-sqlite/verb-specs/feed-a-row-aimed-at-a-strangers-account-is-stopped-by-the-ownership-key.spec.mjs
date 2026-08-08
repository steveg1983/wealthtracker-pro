import {
  USER, SOMEONE_ELSES_ACCOUNT, secondUser,
  accountExists, rowsInAccount, balanceIdentityHolds, auditTrail,
} from './_shared.mjs';

// There is NO ownership check before the inserts here — the account is verified
// only in the second loop, and only for accounts that received rows. So what
// actually stops this write is R-12's composite key, on both engines:
// `transactions_account_id_user_fkey` refuses a row whose (account_id, user_id)
// pair does not exist.
//
// The account demonstrably exists, so only the ownership half of the key can be
// what refused. The sibling spec beside this one shows the case the key cannot
// reach, which is the hole.
export default {
  invariant: 'R-12',
  title: 'a sync row aimed at a stranger\'s account is stopped by the ownership key, not by a check in the function',
  design: '20260808170000_rows_cannot_name_a_foreign_account.sql — transactions_account_id_user_fkey; schema.sql carries the twin',
  consequence: 'the function writes p_user_id as every row\'s owner and never looks at the account until afterwards, so the key is the only thing between a caller and a stranger\'s register',
  parity: 'match',

  setup: secondUser,
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: SOMEONE_ELSES_ACCOUNT, description: 'Shop', amount: '-1.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-1' },
      ],
    },
  },

  expect: {
    postgres: { outcome: 'refused', error: 'transactions_account_id_user_fkey' },
    sqlite: { outcome: 'refused', error: 'FOREIGN KEY constraint failed' },
  },

  state: [
    accountExists(SOMEONE_ELSES_ACCOUNT, '1'),
    rowsInAccount(SOMEONE_ELSES_ACCOUNT, '0'),
    balanceIdentityHolds(SOMEONE_ELSES_ACCOUNT),
    auditTrail('NONE'),
  ],
};
