import { USER } from './_shared.mjs';

export default {
  invariant: 'X-1',
  title: 'categories alone are enough to say no, because they are the collision',
  design: '20260807083000:117-126 asks about accounts, categories and transactions — and categories are the reason: inserting an account mints a To/From category with a FRESH uuid, which the backup already carries under its original one',
  consequence: 'let a restore run with categories present and every transfer in the file points at a category that no longer exists, or the insert dies on the unique key',
  parity: 'match',

  // Accounts and transactions gone, the five categories left standing.
  setup: {
    sqlite: `DELETE FROM transactions WHERE user_id = '${USER}';
             DELETE FROM accounts WHERE user_id = '${USER}';`,
    postgres: `DELETE FROM public.transactions WHERE user_id = '${USER}';
               DELETE FROM public.accounts WHERE user_id = '${USER}';`,
  },
  command: { verb: 'user_financial_data_is_empty', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: { empty: false },
  state: [
    {
      name: 'categories_left',
      sqlite: `SELECT COUNT(*) FROM categories WHERE user_id = '${USER}'`,
      postgres: `SELECT COUNT(*) FROM public.categories WHERE user_id = '${USER}'`,
      expect: '3',
    },
  ],
};
