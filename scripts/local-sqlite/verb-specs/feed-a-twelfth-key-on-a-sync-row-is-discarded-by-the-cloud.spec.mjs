import {
  USER, FED, GROCERIES, aFeedCreatedAccount, twoFilingChoices, setups,
  storedBalances, balanceIdentityHolds, rowsInAccount, fedRow, auditShape,
} from './_shared.mjs';

// D-7 again, on the feed's own row shape. The RPC reads eleven keys with `->>`
// and discards a twelfth in silence.
//
// The key misspelled here is `category`, and the consequence is the one the
// provenance column was added to prevent: the row arrives with NO category
// (payee memory has nothing to work from either), and it arrives CONFIRMED,
// because a blank has nothing to vouch for. So the row is neither categorised
// nor listed as needing attention — it is simply invisible to both screens, and
// the call reported success.
export default {
  invariant: 'D-7',
  title: 'a twelfth key on a sync row is discarded by the cloud and refused by the local edition',
  design: 'import_bank_transactions_atomic 20260808100000:646-665 — eleven ->> reads and nothing else',
  consequence: 'a misspelled category leaves the row uncategorised AND vouched-for, so it appears in neither the suggestions list nor the uncategorised one',
  parity: 'divergent',
  reason: 'DECLARED, and the same divergence every other verb in this crate carries. The cloud discards unknown keys on a feed row; the local edition refuses by name (unknown_field). The Postgres side is what PINS the discard — the day the RPC starts refusing, this fails and the divergence is retired deliberately rather than by drift.',

  setup: setups(aFeedCreatedAccount, twoFilingChoices),
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'Shop', amount: '-1.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-1',
          categoy: GROCERIES },
      ],
    },
  },

  expect: {
    postgres: { outcome: 'ok' },
    sqlite: { outcome: 'refused', error: 'unknown_field' },
  },

  state: [
    fedRow('n-1', { postgres: '- | confirmed=yes | cleared=no', sqlite: 'ABSENT' }),
    rowsInAccount(FED, { postgres: '1', sqlite: '0' }),
    storedBalances(FED, { postgres: '100.00/101.00', sqlite: '100.00/100.00' }),
    balanceIdentityHolds(FED),
    auditShape({ postgres: 'account/update,transaction/create', sqlite: 'NONE' }),
  ],
};
