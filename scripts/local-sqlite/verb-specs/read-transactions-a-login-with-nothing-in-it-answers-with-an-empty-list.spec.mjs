import {
  USER, EVERYDAY, RAINY_DAY,
  nothingOfMine, balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-8',
  title: 'a ledger with nothing in it answers with an empty list, not with a refusal',
  design: 'dataPort.ts holds loadBootTransactions to a floor: it NEVER REJECTS, because the boot effect has one outer catch and reaching it replaces the whole app with "Failed to load data" for somebody whose ledger is fine. An empty ledger is the state every new login starts in',
  consequence: 'the shape matters as much as the emptiness: the far side maps answer.transactions, and null there is a different bug from [] — one says "no transactions" and the other says "this read does not work"',
  parity: 'match',

  setup: nothingOfMine,
  command: { verb: 'list_transactions', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: { transactions: [] },
  state: [
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
