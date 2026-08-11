import { USER, EVERYDAY, MARKED_ROW, everyStateOfCommitment,
  storedFlag, storedTriFlag, auditShape, updatedDay, balanceIdentityHolds } from './_shared.mjs';

// `is_cleared IS DISTINCT FROM p_cleared` is in the CURSOR, not in the UPDATE,
// so a row already ticked is not selected at all: no write, no audit entry, and
// no movement of `updated_at`. The last one is what matters to a file — a
// re-tick that stamped the row would make it look freshly edited to every backup
// diff and every future sync.
//
// The row's `updated_at` is planted in 2019 by `everyStateOfCommitment` so that
// "did not move" is observable rather than a matter of clock resolution — and
// planted ON THE INSERT, because the cloud's BEFORE UPDATE stamp would overwrite
// a planted UPDATE with today. That was measured here, by writing it the other
// way first: Postgres answered `2026-08-11` for a verb that had not touched the
// row.
export default {
  invariant: 'U-1',
  title: 'ticking a row that is already ticked writes nothing at all',
  design: 'set_transactions_cleared 20260810200000:157-162 — the cursor, not the update',
  consequence: 'every re-tick rewrites the row and its audit trail to say the value did not change',
  parity: 'match',

  setup: everyStateOfCommitment,
  command: { verb: 'set_transactions_cleared', payload: { ids: [MARKED_ROW], cleared: true, user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    storedFlag(MARKED_ROW, 'is_cleared', 'yes'),
    storedTriFlag(MARKED_ROW, 'is_reconciled', 'no'),
    updatedDay('transactions', MARKED_ROW, '2019-01-01'),
    auditShape('NONE'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
