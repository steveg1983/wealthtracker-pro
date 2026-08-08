import { USER, chunk, rowCount } from './_shared.mjs';

export default {
  invariant: 'X-1',
  title: 'an empty chunk of accounts is accepted even though the login is full',
  design: '20260807083000:256-266 — the length test comes BEFORE the precondition. MEASURED on the reference cluster',
  consequence: 'a restore of a backup that happens to hold no accounts would otherwise be refused for a precondition it cannot violate',
  parity: 'match',

  command: {
    verb: 'restore_user_chunk',
    payload: { chunks: [chunk('accounts', [])], user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { inserted: 0 },
  state: [rowCount('accounts_now', 'accounts', '2')],
};
