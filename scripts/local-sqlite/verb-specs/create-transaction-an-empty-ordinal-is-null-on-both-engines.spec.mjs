import { USER, EVERYDAY, balanceIdentityHolds } from './_shared.mjs';

const NEW_ROW = '70000000-0000-0000-0000-0000000000b2';

// `NULLIF(p->>'statement_sequence','')::integer`. Three characters of SQL, and
// the whole reason an importer that has always sent `""` for "no ordinal" does
// not start failing at the local edition.
//
// `->>` yields text whether the caller sent 7 or "7", so the RPC accepts both
// and treats "" as absent. The Rust boundary accepts a JSON number, a JSON
// string, and "" — deliberately, and this spec is why. It is punctuation in
// Postgres and a decision in Rust, which is exactly the kind of rule a port
// loses.
export default {
  invariant: 'TS-I4',
  title: 'an empty-string ordinal is NULL, not zero and not an error',
  design: 'NULLIF(p->>\'statement_sequence\', \'\')::integer — 20260808090000:132',
  consequence: 'reading "" as 0 would give every unpositioned row the first place on its day',
  parity: 'match',

  command: {
    verb: 'create_transaction',
    payload: {
      id: NEW_ROW,
      user_id: USER,
      account_id: EVERYDAY,
      description: 'No ordinal on this one',
      amount: '-1.00',
      type: 'expense',
      date: '2024-03-02',
      statement_sequence: '',
    },
  },

  expect: { outcome: 'ok' },
  result: { statement_sequence: null },

  state: [
    balanceIdentityHolds(EVERYDAY),
    {
      name: 'stored_statement_sequence',
      sqlite: `SELECT COALESCE(CAST(statement_sequence AS TEXT), 'NULL')
                 FROM transactions WHERE id = '${NEW_ROW}'`,
      postgres: `SELECT COALESCE(statement_sequence::text, 'NULL')
                   FROM public.transactions WHERE id = '${NEW_ROW}'`,
      expect: 'NULL',
    },
  ],
};
