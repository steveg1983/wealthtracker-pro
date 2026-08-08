import { USER, RESTORED_ROW, backupTransaction, chunk, wipedWithOneAccount } from './_shared.mjs';

export default {
  invariant: 'MONEY-5',
  title: 'a backup may legally hold an amount this file refuses, and it is rejected with a message',
  design: 'PHASE1-PLAN addendum §C. The cloud stores numeric(20,2) and goes to 1e18; schema.sql bounds a single amount at ±1e11 minor. MEASURED both ways: Postgres stores 1,000,000,000,000.00 without comment, SQLite raises transactions_amount_bounded',
  consequence: 'the bound is not fussiness. SQLite\'s sum(INTEGER) RAISES at the int64 cliff where Postgres widens to numeric, so one absurd row leaves the account with NO computable balance rather than a wrong one — the whole aggregate is lost, not one number',
  parity: 'divergent',
  reason: 'The cloud has no per-row money bound and needs none; the local file has one and needs it. This is the import-path half of MONEY-5, and the obligation it discharges is that such a row is REJECTED WITH A MESSAGE naming it, never silently rescaled — rescaling money is inventing it.',

  setup: wipedWithOneAccount,
  command: {
    verb: 'restore_user_chunk',
    payload: {
      chunks: [chunk('transactions', [backupTransaction({ amount: '1000000000000.00', type: 'income' })])],
      user_id: USER,
    },
  },
  expect: {
    sqlite: { outcome: 'refused', error: 'restore_row_refused' },
    postgres: { outcome: 'ok' },
  },
  state: [
    {
      name: 'the_absurd_row',
      sqlite: `SELECT COALESCE((SELECT CAST(amount_minor / 100 AS TEXT) || '.'
                 || substr('0' || CAST(abs(amount_minor) % 100 AS TEXT), -2, 2)
                 FROM transactions WHERE id = '${RESTORED_ROW}'), 'REFUSED')`,
      postgres: `SELECT COALESCE((SELECT amount::text FROM public.transactions
                   WHERE id = '${RESTORED_ROW}'), 'REFUSED')`,
      expect: { sqlite: 'REFUSED', postgres: '1000000000000.00' },
    },
  ],
};
