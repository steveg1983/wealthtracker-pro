import {
  EVERYDAY, PRUNABLE, budgetOnThePrunableByUuidAlone, prunablePair, setups,
  balanceIdentityHolds, categoryPresent,
} from './_shared.mjs';

export default {
  invariant: 'C-7',
  title: 'a budget measuring the category through the uuid column alone DOES save it',
  design: '20260713100000:344-348, `b.category = c.id::text OR b.category_id = c.id` — two columns, where the transaction check one clause earlier reads one',
  consequence: 'a budget whose category is gone measures nothing and reports zero spent for ever, which reads exactly like an underspend. The pair of specs on either side of this one is what pins which reference kinds are protected and which are not',
  parity: 'match',

  setup: setups(prunablePair, budgetOnThePrunableByUuidAlone),
  command: { verb: 'delete_unused_categories', payload: { ids: [PRUNABLE], user_id: null } },
  expect: { outcome: 'ok' },
  result: { deleted: 0 },
  state: [categoryPresent(PRUNABLE, 'HERE'), balanceIdentityHolds(EVERYDAY)],
};
