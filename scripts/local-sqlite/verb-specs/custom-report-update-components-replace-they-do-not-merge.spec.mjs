import {
  USER, EVERYDAY, EXISTING_REPORT, RAINY_DAY, existingCustomReport,
  balanceIdentityHolds, customReportFilter, customReportShape,
} from './_shared.mjs';

// THE RULE THAT SEPARATES THIS ENTITY FROM A GOAL, and the one an engine is most
// likely to improvise: `update_goal` MERGES its `metadata` (`stored || stated`)
// because three unrelated app fields share that one column, and rebuilding it
// from a partial update once deleted a goal's linked accounts. Nothing shares
// these two columns, so `||` here would be the opposite bug — a component the
// person removed would survive every save, come back on the next open, and no
// screen would explain why.
export default {
  invariant: 'D-7',
  title: 'a report’s components and filters are replaced whole, never merged',
  design: 'planningService.updateCustomReport — customReportToDb SETS both jsonb columns; contrast goalToDb, which merges over existingMetadata',
  consequence: 'a merge would make removing a component impossible: it would reappear on every save, and the person would have no way to tell why',
  parity: 'match',

  setup: existingCustomReport,

  command: {
    verb: 'update_custom_report',
    payload: {
      id: EXISTING_REPORT,
      user_id: USER,
      patch: {
        // The stored report has ONE component; this replaces it with a
        // different one. A merge — by key, by id, or by concatenation — leaves
        // two, and that is the whole assertion.
        components: [
          { id: 'two', type: 'pie-chart', title: 'By category', config: {}, width: 'half' },
        ],
        // The stored filters name Everyday, one category and one tag. This
        // states a filter object with a different account and NO categories and
        // NO tags: after a replace, both are gone.
        filters: { dateRange: 'year', accounts: [RAINY_DAY] },
      },
    },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    updated_at: 'stamped by whichever engine performed the write, on its own clock — an edit happens now, so neither side takes the caller’s copy',
  },

  result: {
    id: EXISTING_REPORT,
    user_id: USER,
    // Untouched by the patch, so still what the fixture stored: a field nobody
    // mentioned is left exactly as it was.
    name: 'Where it went',
    description: 'last quarter',
    components: [
      { id: 'two', type: 'pie-chart', title: 'By category', config: {}, width: 'half' },
    ],
    filters: { dateRange: 'year', accounts: [RAINY_DAY] },
    created_at: '2026-03-04T10:00:00.000Z',
  },

  state: [
    // ONE component, not two.
    customReportShape(EXISTING_REPORT, 'Where it went:last quarter:1'),
    customReportFilter(EXISTING_REPORT, 'accounts', RAINY_DAY),
    // The keys the new filters do not mention are GONE rather than kept, which
    // is the half of "replace" a partial merge would still pass without.
    customReportFilter(EXISTING_REPORT, 'categories', 'NONE'),
    customReportFilter(EXISTING_REPORT, 'tags', 'NONE'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
