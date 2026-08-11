import { USER, EVERYDAY, CORNER_SHOP, storedFlag, archivedRowsIn, accountText,
  auditShape, balanceIdentityHolds } from './_shared.mjs';

// Both UPDATEs always run. The cutoff is a statement about the ACCOUNT —
// "everything before this is archived" — and A-3's sweep is what fills it in
// afterwards, one row at a time, as each is committed. An account with a cutoff
// and nothing hidden is the normal state of an account whose old rows are not
// reconciled yet.
//
// `audit_shape` is NONE and that is the RPC's shape rather than an omission
// here: there is no write_financial_audit anywhere in
// archive_transactions_before, while the per-row set_transactions_archived
// audits every row it touches. The asymmetry is the cloud's, twenty lines apart
// in one migration, and this spec is where it is measured rather than argued.
export default {
  invariant: 'A-4',
  title: 'the cutoff is recorded even when nothing was old enough to hide',
  design: 'archive_transactions_before 20260810200000:314-325 — the account UPDATE is not conditional on the row count',
  consequence: 'the archive silently forgets what it was asked to do, and the sweep has no cutoff to read',
  parity: 'match',

  command: {
    verb: 'archive_transactions_before',
    payload: { account_id: EVERYDAY, cutoff: '2024-01-01', user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { archived: 0, cutoff: '2024-01-01' },

  state: [
    storedFlag(CORNER_SHOP, 'archived', 'no'),
    archivedRowsIn(EVERYDAY, '0'),
    accountText(EVERYDAY, 'archive_through_date', '2024-01-01'),
    auditShape('NONE'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
