import {
  USER, EVERYDAY, balanceIdentityHolds, importProvenance,
} from './_shared.mjs';

// The storage half of the same NULLIF(btrim(...)) — asserted separately from the
// duplicate check, because a port could trim in one place and not the other and
// both specs would still be needed to notice.
export default {
  invariant: 'I-4',
  title: 'a padded key is stored trimmed, so the next post of the same key matches it',
  design: 'import_transactions_atomic 20260808140000:348-349 — NULLIF(btrim(r->>\'import_source\'),\'\') in the INSERT itself',
  consequence: 'a key stored with its padding never matches the same key sent without it, so the idempotency the caller was promised silently stops working',
  parity: 'match',

  command: {
    verb: 'import_transactions',
    payload: {
      user_id: USER,
      account_id: EVERYDAY,
      rows: [
        { description: 'Coffee', amount: '-4.25', type: 'expense', date: '2024-05-01',
          import_source: ' ofx ', import_source_id: ' fitid:1 ' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 1, skipped: 0, idempotent: true },

  state: [
    importProvenance('Coffee', '[ofx][fitid:1]'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
