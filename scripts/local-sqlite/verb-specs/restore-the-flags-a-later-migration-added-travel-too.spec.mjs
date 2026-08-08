import { USER, RESTORED_ROW, backupTransaction, chunk, wipedWithOneAccount } from './_shared.mjs';

export default {
  invariant: 'X-7',
  title: 'is_cleared, category_confirmed and the statement ordinal all survive the round trip',
  design: '20260807083000:40-52 — the restore takes WHOLE rows through jsonb_populate_recordset rather than a hand-kept column list, precisely so that a column added later is carried without anybody remembering to add it. These three arrived after the restore did: 20260807180000, 20260808100000, 20260808090000',
  consequence: 'a restore that silently drops a column is worse than one that fails: reconciliation state, who vouched for a category, and the bank\'s own order within a day would all come back as defaults, and nothing would say so',
  parity: 'match',

  setup: wipedWithOneAccount,
  command: {
    verb: 'restore_user_chunk',
    payload: {
      chunks: [chunk('transactions', [backupTransaction({
        is_cleared: true,
        category_confirmed: false,
        statement_sequence: 7,
      })])],
      user_id: USER,
    },
  },
  expect: { outcome: 'ok' },
  result: { inserted: 1 },
  state: [
    {
      name: 'carried_columns',
      sqlite: `SELECT CASE WHEN is_cleared = 1 THEN 'cleared' ELSE 'uncleared' END || '/'
                 || CASE WHEN category_confirmed = 1 THEN 'vouched' ELSE 'guess' END || '/'
                 || COALESCE(CAST(statement_sequence AS TEXT), 'NONE')
                 FROM transactions WHERE id = '${RESTORED_ROW}'`,
      postgres: `SELECT CASE WHEN is_cleared THEN 'cleared' ELSE 'uncleared' END || '/'
                   || CASE WHEN category_confirmed THEN 'vouched' ELSE 'guess' END || '/'
                   || COALESCE(statement_sequence::text, 'NONE')
                   FROM public.transactions WHERE id = '${RESTORED_ROW}'`,
      expect: 'cleared/guess/7',
    },
  ],
};
