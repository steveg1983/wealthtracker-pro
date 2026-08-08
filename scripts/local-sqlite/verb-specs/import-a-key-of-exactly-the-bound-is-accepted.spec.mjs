import {
  USER, EVERYDAY, balanceIdentityHolds, rowsInAccount,
} from './_shared.mjs';

// The control for the bound above. A limit spec that only tests the refusal
// passes just as happily against a port that refuses everything, so the bound is
// pinned from both sides: 200 and 60 are ACCEPTED, 201 and 61 are not.
export default {
  invariant: 'I-4',
  title: 'a key of exactly the permitted length is accepted — the bound is a bound, not a fence',
  design: 'import_transactions_atomic 20260808140000:305 — > 200 and > 60, not >=',
  consequence: 'an off-by-one here rejects a whole import for a key the database would have held perfectly well',
  parity: 'match',

  command: {
    verb: 'import_transactions',
    payload: {
      user_id: USER,
      account_id: EVERYDAY,
      rows: [
        { description: 'Coffee', amount: '-4.25', type: 'expense', date: '2024-05-01',
          import_source: 's'.repeat(60), import_source_id: 'x'.repeat(200) },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 1, skipped: 0, idempotent: true },

  state: [rowsInAccount(EVERYDAY, '2'), balanceIdentityHolds(EVERYDAY)],
};
