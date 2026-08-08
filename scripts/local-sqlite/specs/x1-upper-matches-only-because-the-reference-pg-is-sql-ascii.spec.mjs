// One of the two cross-engine behaviour checks DESIGN.md asks for by name —
// and the one where the harness itself turned out to be the finding.
//
// The design says (§2.5, divergence #1): SQLite's upper() is ASCII-only, so
// upper('café') is 'CAFé' where Postgres gives 'CAFÉ'; payee memory is built on
// upper(btrim(description)), so a payee with a non-ASCII letter groups
// differently on the two engines.
//
// RUN IT AGAINST THIS HARNESS AND THE ENGINES AGREE. Not because the design is
// wrong, but because scripts/local-db/up.sh must export LC_ALL=C (macOS aborts
// the postmaster otherwise), which leaves the reference cluster SQL_ASCII —
// where Postgres's upper() is ASCII-only too. Supabase is UTF8.
//
// So this spec proves the SQLite behaviour, states the observed Postgres
// behaviour honestly, and carries a tripwire: it asserts the reference cluster
// really is SQL_ASCII. The day someone gives the harness a UTF8 cluster, that
// assertion fails, the declared parity fails with it, and the real divergence
// has to be dealt with instead of assumed away.
export default {
  invariant: 'I-6',
  title: 'payee normalisation: identical here, and only because the reference Postgres is SQL_ASCII',
  design: 'DESIGN.md §2.5 and divergence #1; schema.sql description_norm is the single site of the normalisation',
  consequence: 'payee memory auto-categorises the next import from this rule. If the engines fold case differently, the memory a user built in the cloud does not carry over to the local file — and this harness cannot see that happen',
  parity: 'match',

  sqlite: {
    action: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date, category) VALUES
        ('70000000-0000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111',
         'a0000000-0000-0000-0000-000000000001', 'Café Fixture', -450, 'expense', '2024-07-01',
         'c0000000-0000-0000-0000-000000000003'),
        ('70000000-0000-0000-0000-000000000015', '11111111-1111-1111-1111-111111111111',
         'a0000000-0000-0000-0000-000000000001', 'CAFÉ FIXTURE', -450, 'expense', '2024-07-02',
         'c0000000-0000-0000-0000-000000000003');`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    action: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date, category) VALUES
        ('70000000-0000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111',
         'a0000000-0000-0000-0000-000000000001', 'Café Fixture', -4.50, 'expense', '2024-07-01',
         'c0000000-0000-0000-0000-000000000003'),
        ('70000000-0000-0000-0000-000000000015', '11111111-1111-1111-1111-111111111111',
         'a0000000-0000-0000-0000-000000000001', 'CAFÉ FIXTURE', -4.50, 'expense', '2024-07-02',
         'c0000000-0000-0000-0000-000000000003');`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      // 'CAFé FIXTURE' on both: the é is left alone by SQLite because upper()
      // is ASCII-only, and by this Postgres because SQL_ASCII has no case map
      // for it either.
      name: 'normalised_first_spelling',
      sqlite: `SELECT description_norm FROM transactions WHERE id = '70000000-0000-0000-0000-000000000014'`,
      postgres: `SELECT upper(btrim(description)) FROM public.transactions
                  WHERE id = '70000000-0000-0000-0000-000000000014'`,
      expect: 'CAFé FIXTURE',
    },
    {
      // Two spellings, two payees — on BOTH engines here. On a UTF8 Postgres
      // this is 1, and that is exactly the divergence the design flags.
      name: 'payee_groups_for_one_merchant',
      sqlite: `SELECT COUNT(DISTINCT description_norm) FROM transactions
                WHERE id IN ('70000000-0000-0000-0000-000000000014', '70000000-0000-0000-0000-000000000015')`,
      postgres: `SELECT COUNT(DISTINCT upper(btrim(description))) FROM public.transactions
                  WHERE id IN ('70000000-0000-0000-0000-000000000014', '70000000-0000-0000-0000-000000000015')`,
      expect: '2',
    },
    {
      // THE TRIPWIRE. Not a comparison — an assertion about the environment the
      // two rows above were measured in.
      name: 'reference_cluster_encoding',
      only: 'postgres',
      postgres: `SELECT current_setting('server_encoding')`,
      expect: 'SQL_ASCII',
    },
  ],
};
