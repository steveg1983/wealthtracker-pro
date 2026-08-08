import {
  USER, STRANGER, RESTORED_ACCOUNT, backupAccount, chunk, wiped, storedBalances, updatedDay,
} from './_shared.mjs';

export default {
  invariant: 'X-6',
  title: 'a row exported by one login is restored owned by another',
  design: '20260807083000:279-292 — every branch overwrites user_id with the caller. That is the whole point of a backup: "my account is gone, I made a new one, put my file back"',
  consequence: 'a restored row still owned by the login that exported it is invisible to the person who restored it, and counted by every service-role aggregate over the account',
  parity: 'match',

  setup: wiped,
  command: {
    verb: 'restore_user_chunk',
    payload: { chunks: [chunk('accounts', [backupAccount({ user_id: STRANGER })])], user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { inserted: 1 },
  state: [
    {
      name: 'stored_owner',
      sqlite: `SELECT user_id FROM accounts WHERE id = '${RESTORED_ACCOUNT}'`,
      postgres: `SELECT user_id::text FROM public.accounts WHERE id = '${RESTORED_ACCOUNT}'`,
      expect: USER,
    },
    // X-8: the backup's own balance is restored verbatim and is authoritative.
    storedBalances(RESTORED_ACCOUNT, '-25.00/0.00'),
    // X-4, on the INSERT path: nothing re-dates a row nobody updated.
    updatedDay('accounts', RESTORED_ACCOUNT, '2019-01-01'),
  ],
};
