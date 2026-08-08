import {
  USER, EVERYDAY, balanceOf, balanceIdentityHolds, rowsInAccount, importedRow, auditShape,
} from './_shared.mjs';

// D-7 on the ingest surface, and the same declared divergence the create, update
// and split verbs carry: the cloud reads thirteen keys with `->>` and silently
// discards a fourteenth.
//
// The key misspelled here is chosen for its consequence rather than for
// convenience. `is_clered` is a QIF importer forwarding the file's own `C` flag
// and being ignored: every reconciled row in the file arrives UNRECONCILED, the
// reconciliation screen re-asks for work the user has already done, and the only
// evidence is a success response. That is TS-I9's failure mode arriving through
// a typo.
//
// The divergence is one-directional and safe in the direction that matters: no
// caller that works today stops working, because a caller sending a fourteenth
// key is by construction a caller whose intent is already not being carried out.
// It stops being told that it was.
export default {
  invariant: 'D-7',
  title: 'a fourteenth key on an import row is discarded by the cloud and refused by the local edition',
  design: 'import_transactions_atomic 20260808140000:328-350 — thirteen ->> reads and nothing else; there is no key list anywhere to compare against',
  consequence: 'a misspelled is_cleared silently un-reconciles a whole statement and reports success — TS-I9\'s failure arriving through a typo',
  parity: 'divergent',
  reason: 'DECLARED. The cloud discards unknown keys on an import row; the local edition refuses by name (unknown_field) so the caller can tell a typo from a rejection. The Postgres side of this spec is what PINS the discard — the day the RPC starts refusing, this fails and the divergence is retired on purpose rather than by drift.',

  command: {
    verb: 'import_transactions',
    payload: {
      user_id: USER,
      account_id: EVERYDAY,
      rows: [
        { description: 'Reconciled', amount: '-1.00', type: 'expense', date: '2024-05-01', is_clered: true },
      ],
    },
  },

  expect: {
    postgres: { outcome: 'ok' },
    sqlite: { outcome: 'refused', error: 'unknown_field' },
  },

  state: [
    // The heart of it: the cloud stored the row with the flag DROPPED. The user
    // asked for a reconciled row and got a success.
    importedRow('Reconciled', {
      postgres: '- | confirmed=yes | cleared=no | seq=-',
      sqlite: 'ABSENT',
    }),
    rowsInAccount(EVERYDAY, { postgres: '2', sqlite: '1' }),
    balanceOf(EVERYDAY, { postgres: '-26.00', sqlite: '-25.00' }),
    // The divergence is about what the caller is TOLD. Neither engine broke the
    // ledger identity.
    balanceIdentityHolds(EVERYDAY),
    auditShape({ postgres: 'account/update,transaction/create', sqlite: 'NONE' }),
  ],
};
