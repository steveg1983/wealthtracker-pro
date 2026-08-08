import {
  EVERYDAY, PRUNABLE, prunablePair, recurringOnTheSource, setups,
  balanceIdentityHolds, categoryPresent,
} from './_shared.mjs';

export default {
  invariant: 'C-7',
  title: 'a recurring template saves its category — whoever owns the template',
  design: '20260713100000:349-352. This clause has NO user filter, where the transaction and split clauses either side of it do. The migration\'s reasoning: a category id is a globally unique uuid, so matching on it alone can only reach rows that mean this category',
  consequence: 'a scheduled payment whose category is gone would create rows filed under nothing, every month, silently, for as long as the schedule runs',
  parity: 'match',

  // MEASURED (probe-prune1.sh p-used-by-recurring-of-a-stranger): a template
  // belonging to ANOTHER login still saves the category. The two engines
  // genuinely disagree about what recurring_transactions.user_id IS — a Clerk id
  // in the cloud, a users(id) uuid locally — which is exactly why the cloud
  // matches on the category and not on the owner, and why this fixture's owner
  // value is not load-bearing on either side.
  setup: setups(prunablePair, recurringOnTheSource),
  command: { verb: 'delete_unused_categories', payload: { ids: [PRUNABLE], user_id: null } },
  expect: { outcome: 'ok' },
  result: { deleted: 0 },
  state: [categoryPresent(PRUNABLE, 'HERE'), balanceIdentityHolds(EVERYDAY)],
};
