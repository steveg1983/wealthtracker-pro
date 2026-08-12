import {
  USER, EVERYDAY, EXISTING_REPORT, existingCustomReport,
  balanceIdentityHolds, customReportShape, customReportsOwnedBy,
} from './_shared.mjs';

// No `.single()` on the delete's query. Same rule as the budget and goal deletes
// and the dismissal before them.
export default {
  invariant: 'X-6',
  title: 'deleting a report that is already gone is done, not an error',
  design: 'planningService.deleteCustomReport — `.delete().eq(id).eq(user_id)`, and no .single()',
  consequence: 'a double-click, or a second device that got there first, must not turn a decision into an error message',
  parity: 'match',

  setup: existingCustomReport,

  command: {
    verb: 'delete_custom_report',
    payload: { id: 'd0000000-0000-0000-0000-0000000000e0', user_id: USER },
  },

  expect: { outcome: 'ok' },

  result: { deleted: 0 },

  state: [
    customReportsOwnedBy(USER, '1'),
    customReportShape(EXISTING_REPORT, 'Where it went:last quarter:1'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
