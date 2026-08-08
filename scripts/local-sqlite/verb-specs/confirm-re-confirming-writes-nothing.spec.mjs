import { USER, FILED_ROW, everyShapeOfFiling, storedFlag, auditShape } from './_shared.mjs';

// `category_confirmed = false` is in the cursor, so a row that is already
// vouched for is not selected: no write, no audit entry, and — the part that
// matters for the local edition — no movement of `updated_at`, so a re-confirm
// cannot make a row look freshly edited to a sync or a backup diff.
export default {
  invariant: 'U-1',
  title: 'confirming something already confirmed is free',
  design: 'confirm_transaction_categories 20260808100000:457 — the flag is part of the selection, not of the update',
  consequence: 'every re-confirm writes a row and an audit entry saying the value did not change',
  parity: 'match',

  setup: everyShapeOfFiling,
  command: { verb: 'confirm_transaction_categories', payload: { ids: [FILED_ROW], user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    storedFlag(FILED_ROW, 'category_confirmed', 'yes'),
    auditShape('NONE'),
  ],
};
