import {
  EVERYDAY, THEIR_CATEGORY, prunablePair, secondUser, setups, strangersCategory,
  balanceIdentityHolds, categoryPresent,
} from './_shared.mjs';

export default {
  invariant: 'C-7',
  title: 'with NO owner named it reaches every login, and that is the cloud\'s behaviour too',
  design: 'the same clause with p_user_id NULL: the guard stands down entirely. MEASURED on the reference cluster (probe-prune1.sh p-no-owner-named-reaches-everyone), where a stranger\'s category is deleted',
  consequence: 'ported rather than tightened, for the reason user_financial_data_is_empty gives: in the cloud RLS makes the unscoped reading the same answer, and a local port that quietly required an owner would refuse calls the cloud performs. The lock is that the caller has to leave the argument out on purpose',
  parity: 'match',

  setup: setups(prunablePair, secondUser, strangersCategory),
  command: { verb: 'delete_unused_categories', payload: { ids: [THEIR_CATEGORY] } },
  expect: { outcome: 'ok' },
  result: { deleted: 1 },
  state: [categoryPresent(THEIR_CATEGORY, 'GONE'), balanceIdentityHolds(EVERYDAY)],
};
