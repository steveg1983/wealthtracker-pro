import { USER, backupTransaction, chunk, wipedWithOneAccount } from './_shared.mjs';

export default {
  invariant: 'U-1',
  title: 'a restore writes no per-row audit entry, and that is the departure it argues for',
  design: '20260807083000:63-71 — "Restore writes ONE audit row for the whole operation, not one per transaction, departing from the per-row rule set out in 20260805214322 […] the honest answer for every row is identical and is a property of the operation, not the row". MEASURED: restore_user_chunk writes nothing at all; the single entry comes from finalize_user_restore',
  consequence: 'fifty thousand rows each saying "a restore created me" would bury the entries that carry real information — which is the log\'s entire value',
  parity: 'match',

  setup: wipedWithOneAccount,
  command: {
    verb: 'restore_user_chunk',
    payload: { chunks: [chunk('transactions', [backupTransaction()])], user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { inserted: 1 },
  state: [
    {
      name: 'audit_entries',
      sqlite: `SELECT COUNT(*) FROM financial_audit_log WHERE user_id = '${USER}'`,
      postgres: `SELECT COUNT(*) FROM public.financial_audit_log WHERE user_id = '${USER}'`,
      expect: '0',
    },
  ],
};
