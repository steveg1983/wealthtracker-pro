import { EVERYDAY, PRUNABLE, prunablePair, balanceIdentityHolds, categoryPresent } from './_shared.mjs';

export default {
  invariant: 'C-7',
  title: 'a revaluation category — which merge_categories refuses outright — is pruned without comment',
  design: 'the protection list at 20260713100000:334-358 has TWO flag tests, level and is_transfer_category, and no more. merge_categories has five (20260805214322): system, revaluation, unassigned-bucket, transfer, type root',
  consequence: 'the two verbs disagree about what a "built-in" category is, and only one of them is right. Recording the disagreement is what stops a future reader "fixing" the prune to match the merge and quietly refusing a Money-set import that has always worked',
  parity: 'match',

  // MEASURED for all three flags (probe-prune1.sh p-system-category,
  // p-revaluation-category, p-unassigned-bucket): each is deleted. One spec
  // rather than three, because the invariant is "the semantic flags are not part
  // of this verb's protection list" and one flag proves it.
  setup: {
    sqlite: `${prunablePair.sqlite}
      UPDATE categories SET is_revaluation_category = 1 WHERE id = '${PRUNABLE}';`,
    postgres: `${prunablePair.postgres}
      UPDATE public.categories SET is_revaluation_category = true WHERE id = '${PRUNABLE}';`,
  },
  command: { verb: 'delete_unused_categories', payload: { ids: [PRUNABLE], user_id: null } },
  expect: { outcome: 'ok' },
  result: { deleted: 1 },
  state: [categoryPresent(PRUNABLE, 'GONE'), balanceIdentityHolds(EVERYDAY)],
};
