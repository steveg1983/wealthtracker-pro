import {
  USER, EVERYDAY, anAlreadyImportedRow,
  balanceOf, balanceIdentityHolds, rowsInAccount, auditTrail,
} from './_shared.mjs';

// The realistic retry: the chunk boundaries moved, so the second POST overlaps
// the first rather than repeating it. The count has to be truthful about both
// halves — "these were already here" is a different sentence from "something
// went wrong" — and the balance must move by the NEW rows only.
export default {
  invariant: 'I-4',
  title: 'a chunk that overlaps one already posted inserts the new rows and skips the old',
  design: 'import_transactions_atomic 20260808140000:113-120 — DO NOTHING is per-row and exact, so the function can return a truthful skipped count',
  consequence: 'an all-or-nothing refusal would throw away 999 good rows for one repeat, and a silent skip would lose the count the summary shows the user',
  parity: 'match',

  setup: anAlreadyImportedRow,
  command: {
    verb: 'import_transactions',
    payload: {
      user_id: USER,
      account_id: EVERYDAY,
      rows: [
        { description: 'Coffee', amount: '-4.25', type: 'expense', date: '2024-05-01',
          import_source: 'ofx', import_source_id: 'fitid:1' },
        { description: 'Bus', amount: '-2.50', type: 'expense', date: '2024-05-01',
          import_source: 'ofx', import_source_id: 'fitid:2' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 1, skipped: 1, idempotent: true },

  state: [
    rowsInAccount(EVERYDAY, '3'),
    // -29.25 before, and only the 2.50 that actually landed.
    balanceOf(EVERYDAY, '-31.75'),
    balanceIdentityHolds(EVERYDAY),
    auditTrail('transaction/create,account/update'),
  ],
};
