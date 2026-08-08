import { USER, MERGE_SOURCE, MERGE_TARGET, mergeablePair, filedUnderTheSource, setups,
  filedAs, categoryShape, auditShape, referencesTo } from './_shared.mjs';

// C-8/#merge, the direction guard, and the LAST thing checked before the first
// write — MEASURED to fire ahead of merge_left_references (probe-merge2.sh, o15),
// so every guard runs before anything moves.
//
// The row filed under the source is here on purpose: a refusal has to leave it
// exactly where it was, and `references_to` counts it as still pointing at a
// category that still exists.
export default {
  invariant: 'C-13',
  title: 'an expense category cannot be merged into an income one',
  design: 'merge_categories 20260805214322:206-210 — target.type <> \'both\' AND target.type <> source.type',
  consequence: 'half the merged history lands on the wrong side of every income-and-expense report',
  parity: 'match',

  setup: setups(mergeablePair, filedUnderTheSource, {
    sqlite: `UPDATE categories SET type = 'income' WHERE id = '${MERGE_TARGET}';`,
    postgres: `UPDATE public.categories SET type = 'income' WHERE id = '${MERGE_TARGET}';`,
  }),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'refused', error: 'merge_direction_mismatch' },

  state: [
    categoryShape(MERGE_SOURCE, 'Food shopping:expense:detail:0002:-:active'),
    filedAs('70000000-0000-0000-0000-000000000001', 'Food shopping/Food shopping'),
    referencesTo(MERGE_SOURCE, '1'),
    auditShape('NONE'),
  ],
};
