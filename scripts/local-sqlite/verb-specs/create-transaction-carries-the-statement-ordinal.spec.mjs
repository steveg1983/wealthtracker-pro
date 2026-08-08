import { USER, EVERYDAY, balanceOf, balanceIdentityHolds } from './_shared.mjs';

const NEW_ROW = '70000000-0000-0000-0000-0000000000b1';

// `statement_sequence` is the bank's own order WITHIN a day — an ordinal, never
// a time (20260808090000:75-78). It exists because `created_at` cannot order a
// statement: in Postgres it is transaction-start time, so a whole imported file
// shares one value.
//
// The round trip is worth its own spec because the column was added by a
// migration that ALSO silently dropped a different column from the same
// function's list (see the is_cleared spec). A port written from the wrong base
// loses one or the other, and neither loss raises anything.
export default {
  invariant: 'TS-I4',
  title: 'the statement ordinal survives the round trip, as a number and as a string',
  design: 'supabase/migrations/20260808090000_transaction_statement_sequence.sql:99-158, NULLIF(...,\'\')::integer',
  consequence: 'without it three rows on the same day sort by created_at, which a one-transaction import makes identical for all of them',
  parity: 'match',

  command: {
    verb: 'create_transaction',
    payload: {
      id: NEW_ROW,
      user_id: USER,
      account_id: EVERYDAY,
      description: 'Second row on the statement that day',
      amount: '-3.20',
      type: 'expense',
      date: '2024-03-02',
      statement_sequence: 2,
    },
  },

  expect: { outcome: 'ok' },
  result: { statement_sequence: 2 },

  state: [
    balanceOf(EVERYDAY, '-28.20'),
    balanceIdentityHolds(EVERYDAY),
    {
      name: 'stored_statement_sequence',
      sqlite: `SELECT COALESCE(CAST(statement_sequence AS TEXT), 'NULL')
                 FROM transactions WHERE id = '${NEW_ROW}'`,
      postgres: `SELECT COALESCE(statement_sequence::text, 'NULL')
                   FROM public.transactions WHERE id = '${NEW_ROW}'`,
      expect: '2',
    },
  ],
};
