import {
  USER, FED, aFeedCreatedAccount, storedBalances, balanceIdentityHolds, rowsInAccount,
  auditShape,
} from './_shared.mjs';

// Row 1 carries no stamp, so the table decides — BACKFILL, the account is
// fresh. Row 2 stamps `backfill: false` for the same account. A batch split
// across both arms is precisely the drift 20260829170000 exists to end, so a
// contradiction refuses the WHOLE call: the good row ahead of it is rolled
// back too, the same all-or-nothing property the owner-mismatch refusal has.
//
// Named rather than merely errored, on both engines, because "it failed" is
// not a proof the right rule fired.
export default {
  invariant: 'B-4',
  title: 'a stamp that contradicts the call\'s decision is refused whole',
  design: 'import_bank_transactions_atomic 20260829170000 — the ELSIF on a decided account, ERRCODE 22023',
  consequence: 'landing the batch anyway would split it across both balance arms — half the money moved twice, which is the bug itself',
  parity: 'match',

  setup: aFeedCreatedAccount,
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'Good', amount: '-1.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-1' },
        { user_id: USER, account_id: FED, description: 'Contradiction', amount: '-2.00',
          type: 'expense', date: '2024-05-02', external_transaction_id: 'n-2',
          backfill: false },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'backfill_stamp_conflict' },

  state: [
    rowsInAccount(FED, '0'),
    storedBalances(FED, '100.00/100.00'),
    balanceIdentityHolds(FED),
    auditShape('NONE'),
  ],
};
