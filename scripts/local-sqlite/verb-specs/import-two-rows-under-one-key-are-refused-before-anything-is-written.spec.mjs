import {
  USER, EVERYDAY, balanceOf, balanceIdentityHolds, rowsInAccount, auditTrail,
} from './_shared.mjs';

// The one failure mode DO NOTHING could turn into MISSING money, and the reason
// this refusal exists at all (20260808140000:122-125): if a caller gives two
// different rows the same id, the second is discarded as a duplicate of the
// first and counted as "already landed". The user is told two rows arrived; one
// of them is money that is simply not there.
//
// It fires BEFORE the first insert, which is what the state assertions are for:
// a request refused halfway would be worse than one refused late.
export default {
  invariant: 'I-4',
  title: 'two different rows sharing one import id are refused, loudly, before a single row is written',
  design: 'import_transactions_atomic 20260808140000:296-299 — count(DISTINCT (s,i)) FILTER (…) <> count(*) FILTER (…), checked in the pre-loop block',
  consequence: 'DO NOTHING would drop the second row as a duplicate and report it as skipped, so a real payment disappears and the summary says it was already there',
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
          import_source: 'ofx', import_source_id: 'fitid:1' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'import_provenance_duplicate_in_request' },

  state: [
    rowsInAccount(EVERYDAY, '1'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    auditTrail('NONE'),
  ],
};
