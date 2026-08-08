import { USER, rowCount } from './_shared.mjs';

export default {
  invariant: 'X-3',
  title: 'accounts go first, and the counts report statements rather than consequences',
  design: '20260807083000:179-207. Deleting categories while their accounts stand raises transfer_category_protected — MEASURED on both engines — so accounts lead and the To/From rows arrive at the protection with their account already gone',
  consequence: 'the other order stalls the wipe half-done: some tables cleared, the categories refused, and no way through it from the UI',
  parity: 'match',

  command: {
    verb: 'wipe_user_financial_data',
    payload: { confirm: 'DELETE EVERYTHING', user_id: USER },
  },
  expect: { outcome: 'ok' },
  // The numbers are the surprising part and they are surprising on BOTH engines,
  // which is the point of asserting them: `transactions` is 0 because the account
  // delete already cascaded the one row away, and `categories` is 3 rather than 5
  // because the two To/From rows went with their accounts. Each field is an
  // honest report of what ITS OWN statement deleted. SQLite's changes() and
  // Postgres's ROW_COUNT both exclude rows moved by foreign keys and triggers, so
  // neither engine had to be asked to agree.
  result: {
    accounts: 2,
    transactions: 0,
    categories: 3,
    budgets: 0,
    goals: 0,
    investments: 0,
  },
  state: [
    rowCount('accounts_left', 'accounts', '0'),
    rowCount('transactions_left', 'transactions', '0'),
    rowCount('categories_left', 'categories', '0'),
    {
      name: 'the_login_itself_survives',
      sqlite: `SELECT COUNT(*) FROM users WHERE id = '${USER}'`,
      postgres: `SELECT COUNT(*) FROM public.users WHERE id = '${USER}'`,
      expect: '1',
    },
  ],
};
