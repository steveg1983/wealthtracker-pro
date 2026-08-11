import {
  USER, EVERYDAY, RAINY_DAY, SOMEONE_ELSES_ACCOUNT,
  setups, secondUser, strangersRow, derivedBalance, balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'BAL-5',
  title: 'a second login\'s account and its spending are in the file and not in these figures',
  design: 'the cloud takes NO argument here: account_balances() is SECURITY DEFINER and reads its identity from the verified JWT through requesting_user_id(), "so there is no parameter to spoof and an unauthenticated caller matches nothing and gets no rows". A file has no JWT, so the owner arrives in the payload like every other read\'s — and this spec is where the harness proves the two narrow to the same set, by setting the claim rather than by rewriting the function',
  consequence: 'the dashboard\'s headline figure is the sum of this answer. A stranger\'s account leaking into it would put their money in this login\'s net worth, and their spending in the count beside it',
  parity: 'match',

  setup: setups(secondUser, strangersRow),
  command: { verb: 'account_balances', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    account_balances: [
      derivedBalance({ account_id: EVERYDAY, balance: '-25.00', txn_count: 1 }),
      derivedBalance({ account_id: RAINY_DAY, balance: '0.00', txn_count: 0 }),
    ],
  },
  state: [
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    balanceIdentityHolds(SOMEONE_ELSES_ACCOUNT),
    auditRowsInTotal('0'),
  ],
};
