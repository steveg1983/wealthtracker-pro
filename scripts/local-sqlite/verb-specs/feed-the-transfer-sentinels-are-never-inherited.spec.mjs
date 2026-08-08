import {
  USER, FED, aFeedCreatedAccount, setups, balanceIdentityHolds, fedRow,
} from './_shared.mjs';

// The legacy sentinels 'transfer-in' and 'transfer-out' live in
// `transactions.category` as plain text (R-3), so they look exactly like any
// other category to a GROUP BY. Excluding them by name is the only way to keep
// them out, and without it the commonest shape in a real current account — a
// monthly sweep, filed under transfer-out a dozen times — would teach payee
// memory to file the next ordinary payment to that name as a transfer.
export default {
  invariant: 'I-6',
  title: 'the legacy transfer sentinels never become a payee\'s remembered category',
  design: 'payee_memory_category 20260722140000:39 — AND t.category NOT IN (\'transfer-in\', \'transfer-out\')',
  consequence: 'an ordinary payment filed as a transfer is money the transfer report claims moved between two accounts, one of which never saw it',
  parity: 'match',

  setup: setups(aFeedCreatedAccount, {
    sqlite: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date, category)
        VALUES ('70000000-0000-0000-0000-0000000000c9', '${USER}', '${FED}', 'SWEEP', -1000, 'expense', '2024-01-01', 'transfer-out');
      UPDATE accounts SET initial_balance_minor = initial_balance_minor + 1000 WHERE id = '${FED}';`,
    postgres: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date, category)
        VALUES ('70000000-0000-0000-0000-0000000000c9', '${USER}', '${FED}', 'SWEEP', -10.00, 'expense', '2024-01-01', 'transfer-out');
      UPDATE public.accounts SET initial_balance = initial_balance + 10.00 WHERE id = '${FED}';`,
  }),
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'SWEEP', amount: '-9.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-1' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 1, skipped: 0 },

  state: [
    fedRow('n-1', '- | confirmed=yes | cleared=no'),
    balanceIdentityHolds(FED),
  ],
};
