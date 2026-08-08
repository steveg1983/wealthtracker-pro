import { USER, rowCount } from './_shared.mjs';

export default {
  invariant: 'X-2',
  title: 'the confirmation phrase is compared exactly, and nothing goes without it',
  design: '20260807083000:157-160 — IS DISTINCT FROM the literal DELETE EVERYTHING. localBackupService.LOCAL_WIPE_CONFIRMATION holds the same string "so both engines ask the same"',
  consequence: 'a wipe erases every account, transaction, budget and goal in the login; a phrase the caller could supply on the user\'s behalf would make the user\'s typing theatre',
  parity: 'match',

  command: {
    verb: 'wipe_user_financial_data',
    payload: { confirm: 'delete everything', user_id: USER },
  },
  expect: { outcome: 'refused', error: 'wipe_not_confirmed' },
  state: [rowCount('accounts_left', 'accounts', '2'), rowCount('transactions_left', 'transactions', '1')],
};
