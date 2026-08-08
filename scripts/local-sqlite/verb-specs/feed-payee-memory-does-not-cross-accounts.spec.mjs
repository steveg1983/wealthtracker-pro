import {
  USER, FED, EVERYDAY, GROCERIES, aFeedCreatedAccount, twoFilingChoices, setups,
  balanceIdentityHolds, fedRow,
} from './_shared.mjs';

// Payee memory is scoped to ONE account, which is a decision rather than an
// oversight: the same merchant can mean different things on a personal card and
// a business current account, and the whole value of the feature is that it
// learns what THIS account's owner does with THIS payee.
//
// The history here sits in a different account of the SAME login, so a port that
// scoped the lookup by user rather than by account would find it.
export default {
  invariant: 'I-6',
  title: 'a payee filed in one account teaches nothing to an import into another',
  design: 'payee_memory_category 20260722140000:34 — WHERE t.account_id = p_account_id',
  consequence: 'a merchant that means groceries on the household account and stock on the business one would be filed identically in both',
  parity: 'match',

  setup: setups(aFeedCreatedAccount, twoFilingChoices, {
    sqlite: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date, category)
        VALUES ('70000000-0000-0000-0000-0000000000ca', '${USER}', '${EVERYDAY}', 'BIG SHOP', -1000, 'expense', '2024-01-01', '${GROCERIES}');
      UPDATE accounts SET initial_balance_minor = initial_balance_minor + 1000 WHERE id = '${EVERYDAY}';`,
    postgres: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date, category)
        VALUES ('70000000-0000-0000-0000-0000000000ca', '${USER}', '${EVERYDAY}', 'BIG SHOP', -10.00, 'expense', '2024-01-01', '${GROCERIES}');
      UPDATE public.accounts SET initial_balance = initial_balance + 10.00 WHERE id = '${EVERYDAY}';`,
  }),
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'BIG SHOP', amount: '-9.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-1' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 1, skipped: 0 },

  state: [
    fedRow('n-1', '- | confirmed=yes | cleared=no'),
    balanceIdentityHolds(FED),
    balanceIdentityHolds(EVERYDAY),
  ],
};
