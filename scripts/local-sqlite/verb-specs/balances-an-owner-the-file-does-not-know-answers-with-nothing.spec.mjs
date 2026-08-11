import {
  USER, EVERYDAY, RAINY_DAY,
  balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'BAL-5',
  title: 'an owner with no accounts gets an empty list, not a refusal and not a page of zeros',
  design: 'dataPort.ts: getAccountBalances "NEVER REJECTS, AND NEVER GUESSES. An empty map means I don\'t know and the app falls back to its own sum. Returning zeros instead would be a guess, and a wrong one: the seeding rule keys off the map being non-empty, so a map of zeros would paint every account at £0.00 and call it real money"',
  consequence: 'in the cloud this is literally what an unauthenticated caller gets — requesting_user_id() matches nothing and the aggregate returns no rows. The local read has to answer the same way for an owner the file does not hold, because the alternative shapes are both worse: a refusal breaks the boot\'s never-rejects floor, and zeros are money that is not there',
  parity: 'match',

  command: {
    verb: 'account_balances',
    payload: { user_id: '33333333-3333-3333-3333-333333333333' },
  },
  expect: { outcome: 'ok' },
  result: { account_balances: [] },
  state: [
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
