import { USER, MERGE_SOURCE, MERGE_TARGET, mergeablePair, setups,
  categoryShape, auditShape } from './_shared.mjs';

// The mirror of the source guard, and the direction people actually reach for:
// "these are all rubbish, put them back in the review pile". The flag means NOT
// CATEGORISED, so merging into it would UN-file rows that are already filed —
// destroying decisions rather than recording one.
export default {
  invariant: 'C-11',
  title: 'merging into the bucket would un-file transactions that are already filed',
  design: 'merge_categories 20260805214322:187-190',
  consequence: 'a tidy-up run backwards empties the user\'s categorisation into the review band',
  parity: 'match',

  setup: setups(mergeablePair, {
    sqlite: `UPDATE categories SET is_unassigned_bucket = 1 WHERE id = '${MERGE_TARGET}';`,
    postgres: `UPDATE public.categories SET is_unassigned_bucket = true WHERE id = '${MERGE_TARGET}';`,
  }),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'refused', error: 'merge_target_is_unassigned_bucket' },

  state: [
    categoryShape(MERGE_TARGET, 'Groceries:expense:detail:0002:u:active'),
    categoryShape(MERGE_SOURCE, 'Food shopping:expense:detail:0002:-:active'),
    auditShape('NONE'),
  ],
};
