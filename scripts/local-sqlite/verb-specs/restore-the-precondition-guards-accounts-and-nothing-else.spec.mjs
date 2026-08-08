import { USER, EVERYDAY, RESTORED_ROW, backupTransaction, chunk } from './_shared.mjs';

export default {
  invariant: 'X-1',
  title: 'a transactions chunk into a login that is full is NOT refused',
  design: '20260807083000:262 — the precondition is `IF p_entity = \'accounts\' AND NOT …`, and nothing else consults it. MEASURED on the reference cluster: a transactions chunk sent into the base fixture gets past the check',
  consequence: 'the precondition is only as strong as the CALLER\'S ORDERING. backupService.RESTORE_STEPS puts accounts first and says the migration depends on it; if it ever stopped doing so, every other entity would pour into a live login unopposed and this spec is what would say so',
  parity: 'match',

  // No wipe: the base fixture's two accounts, five categories and one
  // transaction are all still there.
  command: {
    verb: 'restore_user_chunk',
    payload: {
      chunks: [chunk('transactions', [backupTransaction({
        account_id: EVERYDAY,
        description: 'Snuck in',
        amount: '-1.00',
        date: '2024-03-02',
      })])],
      user_id: USER,
    },
  },
  expect: { outcome: 'ok' },
  result: { inserted: 1 },
  state: [
    {
      name: 'it_landed',
      sqlite: `SELECT COUNT(*) FROM transactions WHERE id = '${RESTORED_ROW}'`,
      postgres: `SELECT COUNT(*) FROM public.transactions WHERE id = '${RESTORED_ROW}'`,
      expect: '1',
    },
  ],
};
