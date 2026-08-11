import { USER, EVERYDAY, CORNER_SHOP, storedFlag, auditShape,
  balanceIdentityHolds } from './_shared.mjs';

// "An 'archive this' that runs twice is a no-op, not an error" — the RPC's own
// words, and the reason `archived IS DISTINCT FROM p_archived` is in the cursor
// rather than in the WHERE of the update. The row is not written, so it is not
// audited and its `updated_at` does not move.
//
// The "not written" half is asserted here as `audit_shape` NONE rather than as
// an unmoved `updated_at`, and the reason is worth one line: the setup archives
// the row with a plain UPDATE, and on the cloud that fires
// `update_transactions_updated_at` (BEFORE UPDATE), so the stamp is today's on
// both engines before the verb runs and "it did not move" would be unobservable.
// `cleared-a-row-already-in-that-state-is-not-written` is where that half is
// proved, on a fixture that plants the stamp on the INSERT.
export default {
  invariant: 'A-4',
  title: 'archiving a row that is already archived is a successful nothing',
  design: 'set_transactions_archived 20260805145035:206-212 and its comment at :169-171',
  consequence: 'an archive that runs twice reports an error the user cannot act on',
  parity: 'match',

  setup: {
    sqlite: `UPDATE transactions SET archived = 1 WHERE id = '${CORNER_SHOP}';`,
    postgres: `UPDATE public.transactions SET archived = true WHERE id = '${CORNER_SHOP}';`,
  },
  command: {
    verb: 'set_transactions_archived',
    payload: { ids: [CORNER_SHOP], archived: true, user_id: USER },
  },
  expect: { outcome: 'ok' },

  state: [
    storedFlag(CORNER_SHOP, 'archived', 'yes'),
    auditShape('NONE'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
