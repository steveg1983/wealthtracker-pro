// The half of the overflow question that actually decides schema design: the
// money columns as each engine declares them. numeric has no cliff; INTEGER
// minor units do, and that is the whole reason schema.sql carries a bounded
// CHECK on every money column (see money-per-row-amounts-are-bounded).
export default {
  invariant: 'MONEY-5',
  title: 'the declared money types: numeric never overflows, minor units eventually do',
  design: 'DESIGN.md §3.1 — "every numeric(20,x) column has a declared range wider than a SQLite integer once scaled"',
  consequence: 'the local file must bound each money column, because the engine will refuse the whole aggregate rather than the offending row — one bad number and the account has no balance at all',
  parity: 'divergent',
  reason: 'Postgres numeric is arbitrary precision, so the same two rows sum without complaint. SQLite\'s INTEGER sum() hits the int64 boundary. The bounded CHECKs exist to keep real data 92 million rows away from that cliff.',

  sqlite: {
    action: `
      -- The money column's type, without schema.sql's bound, to show what the
      -- bound is protecting against.
      CREATE TABLE _money_probe (amount_minor INTEGER NOT NULL) STRICT;
      INSERT INTO _money_probe VALUES (5000000000000000000), (5000000000000000000);
      SELECT sum(amount_minor) FROM _money_probe;`,
    expect: { outcome: 'refused', message: 'integer overflow' },
  },

  postgres: {
    action: `
      CREATE TEMP TABLE _money_probe (amount numeric(20,2) NOT NULL);
      INSERT INTO _money_probe VALUES (50000000000000000.00), (50000000000000000.00);
      SELECT sum(amount) FROM _money_probe;`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'sum_of_two_enormous_rows',
      only: 'postgres',
      postgres: `SELECT sum(amount)::text FROM _money_probe`,
      expect: '100000000000000000.00',
    },
  ],
};
