// The second cross-engine behaviour check DESIGN.md asks for by name: what each
// engine does when a SUM passes the int64 boundary. Same input, both engines.
//
// The claim under test is DESIGN.md §2.7: SQLite RAISES rather than promoting to
// float. That half is confirmed. The other half is new information: Postgres
// does not raise either — sum(bigint) returns numeric, so it promotes to
// ARBITRARY PRECISION and answers 9223372036854775808. Neither engine gives an
// approximate number; one refuses and one widens.
export default {
  invariant: 'MONEY-5',
  title: 'summing past the int64 boundary: SQLite refuses, Postgres widens — neither goes float',
  design: 'DESIGN.md §2.7; the reason schema.sql bounds every money column',
  consequence: 'if SQLite promoted to REAL here, an overlarge dataset would start returning approximate balances with no error and no way to notice. It does not — it stops',
  parity: 'divergent',
  reason: 'sum(INTEGER) in SQLite is an int64 accumulator and raises "integer overflow" at the boundary. sum(bigint) in Postgres is declared to return numeric, so the accumulation happens in arbitrary precision and never overflows. The local file therefore needs bounded CHECKs where the cloud needs none — which is precisely why schema.sql has them.',

  sqlite: {
    action: `
      CREATE TABLE _overflow_probe (x INTEGER NOT NULL) STRICT;
      INSERT INTO _overflow_probe VALUES (9223372036854775807), (1);
      SELECT sum(x) FROM _overflow_probe;`,
    expect: { outcome: 'refused', message: 'integer overflow' },
  },

  postgres: {
    action: `
      CREATE TEMP TABLE _overflow_probe (x bigint NOT NULL);
      INSERT INTO _overflow_probe VALUES (9223372036854775807), (1);
      SELECT sum(x) FROM _overflow_probe;`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'sum_past_the_boundary',
      only: 'postgres',
      postgres: `SELECT sum(x)::text FROM _overflow_probe`,
      // One past INT64_MAX, exactly — not rounded, not approximated.
      expect: '9223372036854775808',
    },
  ],
};
