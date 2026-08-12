import {
  USER, EVERYDAY, EXISTING_REPORT, existingCustomReport,
  balanceIdentityHolds, customReportShape, customReportsOwnedBy,
} from './_shared.mjs';

// `.single()` again — the same word in the cloud's query that makes the budget
// and goal updates refuse, and `delete_custom_report` again does not have it.
export default {
  invariant: 'D-7',
  title: 'updating a report that is not there is refused, and the store is untouched',
  design: 'the `.single()` on planningService.updateCustomReport',
  consequence: 'a save submitted from a page another device has already deleted the report on would otherwise create a report nobody built, holding a question nobody asked',
  parity: 'match',

  setup: existingCustomReport,

  command: {
    verb: 'update_custom_report',
    payload: {
      id: 'd0000000-0000-0000-0000-0000000000e0',
      user_id: USER,
      patch: { name: 'Something else' },
    },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'custom_report_not_found' },
    postgres: { outcome: 'refused', error: 'PGRST116' },
  },

  state: [
    customReportsOwnedBy(USER, '1'),
    customReportShape(EXISTING_REPORT, 'Where it went:last quarter:1'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
