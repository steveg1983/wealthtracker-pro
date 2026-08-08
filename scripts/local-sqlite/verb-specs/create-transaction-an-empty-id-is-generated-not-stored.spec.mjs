import {
  USER, EVERYDAY, balanceOf, balanceIdentityHolds, rowsInAccount, auditRowsInTotal,
} from './_shared.mjs';

// `COALESCE(NULLIF(p->>'id',''), gen_random_uuid())`. An absent OR EMPTY id
// means "you choose"; only a non-empty one is honoured.
//
// The two engines generate different uuids, obviously, so the runner excludes
// `id` from its full-row comparison when the payload did not supply one — and
// this is the one spec that relies on that. Everything the spec can compare, it
// compares: a row exists, exactly one, its balance moved, and it has an audit
// entry whose subject is that same generated id.
export default {
  invariant: 'B-2',
  title: 'an empty id means "generate one", and the generated id is what the audit row names',
  design: 'COALESCE(NULLIF(p->>\'id\', \'\')::uuid, gen_random_uuid()) — 20260808100000:137',
  consequence: 'storing "" as the primary key would collide on the second row and put an empty string in every audit entry',
  parity: 'match',

  command: {
    verb: 'create_transaction',
    payload: {
      id: '',
      user_id: USER,
      account_id: EVERYDAY,
      description: 'Let the engine name it',
      amount: '-2.50',
      type: 'expense',
      date: '2024-03-02',
    },
  },

  expect: { outcome: 'ok' },

  state: [
    balanceOf(EVERYDAY, '-27.50'),
    balanceIdentityHolds(EVERYDAY),
    rowsInAccount(EVERYDAY, '2'),
    auditRowsInTotal('1'),
    {
      name: 'rows_with_a_blank_id',
      sqlite: "SELECT COUNT(*) FROM transactions WHERE trim(id) = ''",
      postgres: "SELECT COUNT(*) FROM public.transactions WHERE trim(id::text) = ''",
      expect: '0',
    },
    {
      name: 'the_audit_row_names_the_row_that_was_created',
      sqlite: `SELECT CASE WHEN EXISTS (
                 SELECT 1 FROM financial_audit_log a
                   JOIN transactions t ON t.id = a.entity_id
                  WHERE a.entity = 'transaction' AND t.description = 'Let the engine name it')
               THEN 'resolves' ELSE 'dangling' END`,
      postgres: `SELECT CASE WHEN EXISTS (
                   SELECT 1 FROM public.financial_audit_log a
                     JOIN public.transactions t ON t.id = a.entity_id
                    WHERE a.entity = 'transaction' AND t.description = 'Let the engine name it')
                 THEN 'resolves' ELSE 'dangling' END`,
      expect: 'resolves',
    },
  ],
};
