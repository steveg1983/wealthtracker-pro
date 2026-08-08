import { backupAccount, chunk, wiped } from './_shared.mjs';

export default {
  invariant: 'X-6',
  title: 'a restore that cannot say which login it is for is refused first of all',
  design: '20260807083000:245-249 — before the array test, before the precondition, before anything is read',
  consequence: 'every row a restore writes is re-owned to the caller, so a caller with no identity would own the whole file',
  parity: 'match',

  setup: wiped,
  command: {
    verb: 'restore_user_chunk',
    payload: { chunks: [chunk('accounts', [backupAccount()])] },
  },
  expect: { outcome: 'refused', error: 'owner_unknown' },
};
