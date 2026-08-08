import { USER, MERGE_SOURCE, MERGE_TARGET, mergeablePair, setups,
  categoryShape, auditShape } from './_shared.mjs';

// Only the TARGET is guarded for this, and the asymmetry is deliberate and
// MEASURED (probe-merge3.sh, e1: an inactive SOURCE is accepted). Hiding a
// category you are about to empty is not a reason to refuse to empty it; filing
// history into something that appears in no picker is.
export default {
  invariant: 'C-13',
  title: 'a hidden category is not somewhere new history can be filed',
  design: 'merge_categories 20260805214322:191-194 — is_active IS FALSE, target only',
  consequence: 'the merge files everything under a category the user cannot see or choose again',
  parity: 'match',

  setup: setups(mergeablePair, {
    sqlite: `UPDATE categories SET is_active = 0 WHERE id = '${MERGE_TARGET}';`,
    postgres: `UPDATE public.categories SET is_active = false WHERE id = '${MERGE_TARGET}';`,
  }),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'refused', error: 'merge_target_inactive' },

  state: [
    categoryShape(MERGE_TARGET, 'Groceries:expense:detail:0002:-:hidden'),
    categoryShape(MERGE_SOURCE, 'Food shopping:expense:detail:0002:-:active'),
    auditShape('NONE'),
  ],
};
