import { transferPair } from './_setups.mjs';

// THE CONTROL for T-8, named in DESIGN.md §7.5.
//
// Open a connection WITHOUT PRAGMA foreign_keys = ON, delete one leg, and the
// other leg must be left pointing at a row that no longer exists. If this spec
// ever fails, foreign keys have become default-on somewhere — and the startup
// assertion in the Rust connection setup has stopped being load-bearing.
export default {
  invariant: 'T-8',
  title: 'without the foreign-key pragma, ON DELETE SET NULL does nothing at all',
  design: 'DESIGN.md §2.1 and §7.5; PRAGMA foreign_keys defaults to 0, per connection',
  consequence: 'every ON DELETE SET NULL in the schema — the deliberate stranding of a transfer leg included — is inert, and the file quietly fills with pointers to deleted rows',
  parity: 'not-comparable',
  reason: 'Postgres has no per-connection switch that turns foreign keys off. This control exists to prove the SQLite pragma is doing work, and it has no cloud counterpart.',

  sqlite: {
    // A connection of its own, because the pragma is per connection and the
    // shared one must stay honest for every other spec.
    isolation: 'fresh-db',
    pragmas: ['PRAGMA foreign_keys = OFF'],
    setup: transferPair.sqlite,
    action: `DELETE FROM transactions WHERE id = '70000000-0000-0000-0000-000000000005';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    skip: 'no per-connection foreign-key switch exists in Postgres; the property is not expressible there',
  },

  verify: [
    {
      name: 'other_leg_left_dangling',
      only: 'sqlite',
      sqlite: `SELECT CASE WHEN linked_transfer_id = '70000000-0000-0000-0000-000000000005'
                           THEN 'DANGLING' ELSE 'CLEARED' END
                 FROM transactions WHERE id = '70000000-0000-0000-0000-000000000004'`,
      expect: 'DANGLING',
    },
  ],
};
