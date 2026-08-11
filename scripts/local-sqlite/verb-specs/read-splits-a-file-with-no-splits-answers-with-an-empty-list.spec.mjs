import {
  USER, EVERYDAY, RAINY_DAY,
  balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-11',
  title: 'a ledger with no split lines in it answers with an empty list',
  design: 'dataService.loadBoot reads this one inside its own try/catch and falls back to [], because splits are the one boot read the app can genuinely do without: they feed category aggregation, not the register. The answer for a person who has never split a transaction is the commonest answer this verb gives',
  consequence: 'the shape again: the far side maps answer.transaction_splits, and null there would be read as a store that does not work rather than as a person who does not split things',
  parity: 'match',

  command: { verb: 'list_transaction_splits', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: { transaction_splits: [] },
  state: [
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
