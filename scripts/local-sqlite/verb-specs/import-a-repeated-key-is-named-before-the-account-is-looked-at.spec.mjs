import {
  USER, SOMEONE_ELSES_ACCOUNT, secondUser, accountExists, balanceIdentityHolds, rowsInAccount,
} from './_shared.mjs';

// THE MEASURED SURPRISE in the refusal order, made executable.
//
// All four provenance checks run before the account is read, so a request aimed
// at an account this login does not own is told about its OWN malformed keys
// first. Both engines agree, and the ordering is only visible when both faults
// are true at once — which is what this payload does.
//
// It is safe in the way that matters: every one of those four checks reads the
// PAYLOAD, so nothing about the account, its existence or its owner can leak
// through them. The sibling spec asserts what happens when the keys are fine.
export default {
  invariant: 'R-12',
  title: 'a malformed request is named before the caller is told the account is not theirs',
  design: 'import_transactions_atomic 20260808140000:268-320 — the provenance block, then SELECT … FOR UPDATE',
  consequence: 'the order is part of the contract: reversing it would answer "not your account" to a client bug, and the client would retry forever against the right account',
  parity: 'match',

  setup: secondUser,
  command: {
    verb: 'import_transactions',
    payload: {
      user_id: USER,
      account_id: SOMEONE_ELSES_ACCOUNT,
      rows: [
        { description: 'A', amount: '-1.00', type: 'expense', date: '2024-05-01',
          import_source: 'ofx', import_source_id: 'k' },
        { description: 'B', amount: '-1.00', type: 'expense', date: '2024-05-01',
          import_source: 'ofx', import_source_id: 'k' },
      ],
    },
  },

  expect: { outcome: 'refused', error: 'import_provenance_duplicate_in_request' },

  state: [
    accountExists(SOMEONE_ELSES_ACCOUNT, '1'),
    rowsInAccount(SOMEONE_ELSES_ACCOUNT, '0'),
    balanceIdentityHolds(SOMEONE_ELSES_ACCOUNT),
  ],
};
