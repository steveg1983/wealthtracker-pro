import { USER, backupTransaction, chunk, wiped } from './_shared.mjs';

export default {
  invariant: 'R-12',
  title: 'a transaction naming an account the file did not bring is refused by the ownership key',
  design: '20260808170000 replaced transactions_account_id_fkey with a two-column key on (account_id, user_id), and schema.sql carries the twin. A restore inserts accounts before transactions precisely so that key resolves',
  consequence: 'a ledger row filed against an account nobody has is a row whose money is in no balance — the exact defect the composite key was written to make impossible',
  parity: 'match',

  setup: wiped,
  command: {
    verb: 'restore_user_chunk',
    payload: { chunks: [chunk('transactions', [backupTransaction()])], user_id: USER },
  },
  // Both engines refuse; only the wording differs. Postgres names
  // transactions_account_id_user_fkey, SQLite says "FOREIGN KEY constraint
  // failed" — SQLite does not name a key in its message, which is why the local
  // refusal is wrapped with the entity and the row's own id instead.
  expect: {
    sqlite: { outcome: 'refused', error: 'restore_row_refused' },
    postgres: { outcome: 'refused', error: 'transactions_account_id_user_fkey' },
  },
};
