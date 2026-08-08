import {
  USER, FED, aFeedAccountWithAFileImport, storedBalances, balanceIdentityHolds,
} from './_shared.mjs';

// The two provenance systems are deliberately separate, and this is the
// behaviour that separation buys. 20260808140000:127-135 argues it from the
// other side: writing OFX file ids into external_transaction_id "would make an
// imported statement masquerade as a bank-fed account and suppress the first
// real sync's initial_balance rebase".
//
// So an account holding a hand-imported OFX statement is still on its FIRST feed
// import, and the rebase still happens.
export default {
  invariant: 'I-5',
  title: 'a file-imported row does not make an account "already fed"',
  design: 'import_bank_transactions_atomic 20260808100000:594-598 — the existence test reads external_transaction_id and nothing else',
  consequence: 'if a file import counted as feed history the first real sync would add 90 days of transactions to a balance that already contains them',
  parity: 'match',

  setup: aFeedAccountWithAFileImport,
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'Shop', amount: '-12.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-1' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 1, skipped: 0 },

  state: [
    storedBalances(FED, '100.00/117.00'),
    balanceIdentityHolds(FED),
  ],
};
