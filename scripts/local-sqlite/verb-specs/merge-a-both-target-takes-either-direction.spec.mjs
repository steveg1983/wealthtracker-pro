import { USER, MERGE_SOURCE, MERGE_TARGET, mergeablePair, filedUnderTheSource, setups,
  filedAs, categoryShape, auditShape, referencesTo } from './_shared.mjs';

// The control for the direction guard, and not a formality: `both` is what the
// revaluation leaves and the unparented "other" categories carry, and a port
// that compared `target.type <> source.type` alone would refuse every merge into
// one of them. It also proves the guard is not vacuous in the other direction —
// this same fixture with an `income` target is refused by the previous spec.
export default {
  invariant: 'C-13',
  title: 'a category with no direction of its own takes an expense one',
  design: 'merge_categories 20260805214322:200-210 — the \'both\' escape in the direction guard',
  consequence: 'merging into a revaluation or unparented category is refused for a reason that does not exist',
  parity: 'match',

  setup: setups(mergeablePair, filedUnderTheSource, {
    sqlite: `UPDATE categories SET type = 'both' WHERE id = '${MERGE_TARGET}';`,
    postgres: `UPDATE public.categories SET type = 'both' WHERE id = '${MERGE_TARGET}';`,
  }),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'ok' },
  result: { category: MERGE_TARGET, category_id: MERGE_TARGET },

  state: [
    categoryShape(MERGE_SOURCE, 'GONE'),
    categoryShape(MERGE_TARGET, 'Groceries:both:detail:0002:-:active'),
    filedAs('70000000-0000-0000-0000-000000000001', 'Groceries/Groceries'),
    referencesTo(MERGE_SOURCE, '0'),
    auditShape('category/delete,transaction/update'),
  ],
};
