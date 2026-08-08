import { USER, MERGE_SOURCE, MERGE_TARGET, mergeablePair, setups,
  categoryShape, auditShape } from './_shared.mjs';

// ONE code, TWO causes: `is_revaluation_category IS TRUE OR is_system IS TRUE`.
// This spec sets is_system; the flag matters because the app resolves these
// categories BY FLAG rather than by id, so merging one away breaks a write path
// and not merely a report — a valuation adjustment would have nowhere to land.
export default {
  invariant: 'C-13',
  title: 'a category the app files under by itself cannot be merged away',
  design: 'merge_categories 20260805214322:159-162 — is_revaluation_category OR is_system, one message',
  consequence: 'the revaluation leaf disappears and the next valuation adjustment has no category to resolve to',
  parity: 'match',

  setup: setups(mergeablePair, {
    sqlite: `UPDATE categories SET is_system = 1 WHERE id = '${MERGE_SOURCE}';`,
    postgres: `UPDATE public.categories SET is_system = true WHERE id = '${MERGE_SOURCE}';`,
  }),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'refused', error: 'merge_source_is_system_category' },

  state: [
    categoryShape(MERGE_SOURCE, 'Food shopping:expense:detail:0002:s:active'),
    auditShape('NONE'),
  ],
};
