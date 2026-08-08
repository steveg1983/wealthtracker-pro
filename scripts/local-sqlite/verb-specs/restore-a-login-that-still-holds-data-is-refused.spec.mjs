import { USER, backupAccount, chunk, rowCount } from './_shared.mjs';

export default {
  invariant: 'X-1',
  title: 'a restore into a login that still holds data is refused before a row lands',
  design: '20260807083000:260-266 — the precondition, checked when the entity is accounts, and accounts always lead the order',
  consequence: 'the migration says it in one sentence: restoring on top would mix two datasets and silently re-date your history. It also kills three more hazards for free — the To/From category collision, the seeded default-category clash, and a repeated import',
  parity: 'match',

  command: {
    verb: 'restore_user_chunk',
    payload: { chunks: [chunk('accounts', [backupAccount()])], user_id: USER },
  },
  expect: { outcome: 'refused', error: 'restore_target_not_empty' },
  state: [rowCount('accounts_now', 'accounts', '2')],
};
