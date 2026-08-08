import {
  USER, EVERYDAY, balanceOf, balanceIdentityHolds,
} from './_shared.mjs';

// The distinction the flag exists to draw. Two rows land; one of them carries no
// key, so a repeat of this request would insert that row a second time. The
// count is 2 and the promise is false, and those two facts are not in tension —
// they answer different questions.
export default {
  invariant: 'I-4',
  title: 'one unkeyed row makes the WHOLE request unsafe to re-post, however many were keyed',
  design: 'import_transactions_atomic 20260808140000:399 — idempotent = v_rows > 0 AND v_keyed = v_rows',
  consequence: 'a flag that meant "some rows are keyed" would licence a retry that duplicates the unkeyed ones — exactly the double-count the migration exists to stop',
  parity: 'match',

  command: {
    verb: 'import_transactions',
    payload: {
      user_id: USER,
      account_id: EVERYDAY,
      rows: [
        { description: 'Coffee', amount: '-4.25', type: 'expense', date: '2024-05-01',
          import_source: 'ofx', import_source_id: 'fitid:1' },
        { description: 'Bus', amount: '-2.50', type: 'expense', date: '2024-05-01' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 2, skipped: 0, idempotent: false },

  state: [balanceOf(EVERYDAY, '-31.75'), balanceIdentityHolds(EVERYDAY)],
};
