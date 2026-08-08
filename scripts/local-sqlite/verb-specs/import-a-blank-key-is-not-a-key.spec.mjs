import {
  USER, EVERYDAY, balanceOf, balanceIdentityHolds, importProvenance,
} from './_shared.mjs';

// The other half of the NULLIF: a pair of blanks is not half a key, it is NO
// key, and the row inserts exactly as an unprovenanced one does. Without this,
// every blank-keyed row in a file would collide with every other under one
// ('', '') pair and all but the first would vanish.
export default {
  invariant: 'I-3',
  title: 'a row whose provenance is blank on both sides is simply unkeyed',
  design: 'import_transactions_atomic 20260808140000:269-271 — btrim + NULLIF so "a blank string means not stated rather than becoming a key that collides with every other blank"',
  consequence: 'blank keys treated as a value would make every unkeyed row in a file a duplicate of the first, and ON CONFLICT would discard the rest in silence',
  parity: 'match',

  command: {
    verb: 'import_transactions',
    payload: {
      user_id: USER,
      account_id: EVERYDAY,
      rows: [
        { description: 'Coffee', amount: '-4.25', type: 'expense', date: '2024-05-01',
          import_source: '  ', import_source_id: '' },
        { description: 'Bus', amount: '-2.50', type: 'expense', date: '2024-05-01',
          import_source: '', import_source_id: '   ' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 2, skipped: 0, idempotent: false },

  state: [
    importProvenance('Coffee', '[-][-]'),
    importProvenance('Bus', '[-][-]'),
    balanceOf(EVERYDAY, '-31.75'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
