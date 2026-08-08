import {
  USER, EVERYDAY, balanceOf, balanceIdentityHolds, rowsInAccount,
} from './_shared.mjs';

// `NULLIF(btrim(…),'')` runs BEFORE the distinct count and before storage, so
// ` fitid:1 ` and `fitid:1` are one key in both places. If trimming happened only
// on the way into the column, this request would pass the duplicate check and
// then lose a row to the unique index — which is the exact shape the check
// exists to prevent, arriving through the back door.
export default {
  invariant: 'I-4',
  title: 'a key wearing two spellings is caught by the duplicate check, because trimming happens first',
  design: 'import_transactions_atomic 20260808140000:280-282 — NULLIF(btrim(e.value->>…),\'\') feeds the count AND the insert',
  consequence: 'a whitespace difference would slip past the guard and then be swallowed by ON CONFLICT, losing a row the caller was told had landed',
  parity: 'match',

  command: {
    verb: 'import_transactions',
    payload: {
      user_id: USER,
      account_id: EVERYDAY,
      rows: [
        { description: 'Coffee', amount: '-4.25', type: 'expense', date: '2024-05-01',
          import_source: 'ofx', import_source_id: 'fitid:1' },
        { description: 'Bus', amount: '-2.50', type: 'expense', date: '2024-05-01',
          import_source: 'ofx', import_source_id: ' fitid:1 ' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'import_provenance_duplicate_in_request' },

  state: [
    rowsInAccount(EVERYDAY, '1'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
