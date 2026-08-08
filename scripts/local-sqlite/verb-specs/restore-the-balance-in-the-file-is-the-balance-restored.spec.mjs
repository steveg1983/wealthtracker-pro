import {
  USER, RESTORED_ACCOUNT, backupTransaction, chunk, wipedWithOneAccount, storedBalances,
} from './_shared.mjs';

export default {
  invariant: 'X-8',
  title: 'restoring a transaction moves no balance — the file\'s own figure is authoritative',
  design: '20260807083000:54-61 — "Not balance-neutral, deliberately. No trigger maintains accounts.balance; it is a stored column written explicitly by each RPC, and inserting transactions moves nothing"',
  consequence: 'recomputing from transactions would discard any balance reconciled against a statement, and would differ from the source wherever archived history sits behind an opening balance',
  parity: 'match',

  setup: wipedWithOneAccount,
  command: {
    verb: 'restore_user_chunk',
    payload: { chunks: [chunk('transactions', [backupTransaction()])], user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { inserted: 1 },
  state: [
    // −25.00 was already the account's balance and the restored row is −25.00.
    // A balance-moving restore would leave −50.00 here, and B-1 would then be
    // broken in the direction that looks like the user spent it twice.
    storedBalances(RESTORED_ACCOUNT, '-25.00/0.00'),
  ],
};
