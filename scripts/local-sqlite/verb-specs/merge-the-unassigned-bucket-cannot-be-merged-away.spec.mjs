import { USER, MERGE_SOURCE, MERGE_TARGET, mergeablePair, setups,
  categoryShape, auditShape } from './_shared.mjs';

// The one flag that DECLASSIFIES. Rows in the import's Unassigned bucket are not
// categorised at all (20260724100000:21-23), so merging the bucket into a real
// category would file every unreviewed row as something the user never chose —
// in one click, with no way to tell afterwards which rows were guesses.
export default {
  invariant: 'C-11',
  title: 'the bucket that means "not categorised" cannot be merged into a real category',
  design: 'merge_categories 20260805214322:166-169, and the flag\'s meaning at 20260724100000:21-23',
  consequence: 'the whole review band is silently filed as one category and the guesses become indistinguishable from decisions',
  parity: 'match',

  setup: setups(mergeablePair, {
    sqlite: `UPDATE categories SET is_unassigned_bucket = 1 WHERE id = '${MERGE_SOURCE}';`,
    postgres: `UPDATE public.categories SET is_unassigned_bucket = true WHERE id = '${MERGE_SOURCE}';`,
  }),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'refused', error: 'merge_source_is_unassigned_bucket' },

  state: [
    categoryShape(MERGE_SOURCE, 'Food shopping:expense:detail:0002:u:active'),
    auditShape('NONE'),
  ],
};
