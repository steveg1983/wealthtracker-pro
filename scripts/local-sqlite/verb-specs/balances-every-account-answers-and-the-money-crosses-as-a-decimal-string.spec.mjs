import {
  USER, EVERYDAY, RAINY_DAY,
  transferPair, derivedBalance, balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'BAL-1',
  title: 'a ledger with money on both sides of a transfer answers to the penny, as text',
  design: 'money.rs\'s to_decimal_string is the ONE place minor units become the text the app parses, and toAccountBalanceMap on the far side takes whatever arrives through Decimal — "PostgREST renders numeric as a JSON number or a string depending on the value", so a port that answered with a JSON number would be handing the client a float to round',
  consequence: 'PHASE3-PLAN D-4\'s decisive argument for putting reads in the crate at all: a second layer\'s `minor as f64 / 100.0` is one careless line in the numbers on screen. This is that line\'s absence, asserted — −40.00 out of one account and 15.00 into the other, from an integer column on one engine and a numeric on the other, compared as the same text',
  parity: 'match',

  setup: transferPair,
  command: { verb: 'account_balances', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    account_balances: [
      derivedBalance({ account_id: EVERYDAY, balance: '-40.00', txn_count: 2 }),
      derivedBalance({ account_id: RAINY_DAY, balance: '15.00', txn_count: 1 }),
    ],
  },
  state: [
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
