import { USER, splitWithTransferLeg, rowCount } from './_shared.mjs';

export default {
  invariant: 'R-5',
  title: 'a split transfer leg does not stop a wipe — the guard the obligation predicted',
  design: 'PHASE1-PLAN addendum §A named the wipe as one of the paths owing _rpc_guard(\'leg\'), before the verb existed. MEASURED: without it, DELETE FROM accounts raises split_leg_line_removed through the cascade into transaction_splits, and _rpc_guard(\'split\') does not help',
  consequence: 'the commonest split shape in the owner\'s own imported data — 86 of 364 lines — would make the login unclearable, and therefore unrestorable',
  parity: 'match',

  setup: splitWithTransferLeg,
  command: {
    verb: 'wipe_user_financial_data',
    payload: { confirm: 'DELETE EVERYTHING', user_id: USER },
  },
  expect: { outcome: 'ok' },
  state: [
    rowCount('accounts_left', 'accounts', '0'),
    rowCount('splits_left', 'transaction_splits', '0'),
    rowCount('transactions_left', 'transactions', '0'),
    {
      // The guard is the caller's, held for the length of one call and released
      // before it returns. A stray flag would leave S-9 and S-10 standing down
      // for every later write in the file.
      name: 'the_guard_was_put_back',
      sqlite: 'SELECT COUNT(*) FROM _rpc_guard',
      postgres: "SELECT CASE WHEN current_setting('app.split_rpc', true) IN ('', '0') THEN 0 ELSE 1 END",
      expect: '0',
    },
  ],
};
