import {
  USER, EVERYDAY, balanceOf, rowsInAccount, balanceIdentityHolds,
} from './_shared.mjs';

// The btree bound, refused where the caller can read it rather than deep inside
// the insert loop with an internal-sounding message. 200 characters is far above
// every shape the app sends: an OFX FITID key runs to about 60 and a `post:` key
// to about 50.
export default {
  invariant: 'I-4',
  title: 'an import id longer than the index will hold is refused before the loop, by name',
  design: 'import_transactions_atomic 20260808140000:301-308',
  consequence: 'without it the failure arrives from inside the btree, mid-batch, wearing a message about pages rather than about the request',
  parity: 'match',

  command: {
    verb: 'import_transactions',
    payload: {
      user_id: USER,
      account_id: EVERYDAY,
      rows: [
        { description: 'Coffee', amount: '-4.25', type: 'expense', date: '2024-05-01',
          import_source: 'ofx', import_source_id: 'x'.repeat(201) },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'import_provenance_too_long' },

  state: [
    rowsInAccount(EVERYDAY, '1'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
