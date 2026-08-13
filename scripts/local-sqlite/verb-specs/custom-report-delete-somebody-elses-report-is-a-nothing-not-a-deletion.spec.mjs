import {
  USER, EVERYDAY, EXISTING_REPORT, STRANGER, existingCustomReport, secondUser,
  balanceIdentityHolds, customReportShape, customReportsOwnedBy,
} from './_shared.mjs';

// B-3's second half, at the verb: a write whose owner is not the row's owner
// must not reach the row. In the cloud the `.eq('user_id', …)` is what stops it
// and RLS is what stops it again; in a file there is no RLS to narrow an answer
// afterwards, so the verb's own predicate is the whole of the isolation story
// and it is worth asserting rather than assuming.
//
// A NOTHING rather than a refusal, because the delete has no `.single()`: the
// engines cannot tell "not yours" from "not there", and inventing a distinction
// on one side would be a way to confirm that a report exists to somebody who
// does not own it.
export default {
  invariant: 'B-3',
  title: 'deleting a report that belongs to somebody else removes nothing and says nothing',
  design: 'planningService.deleteCustomReport — `.eq(user_id)` on the delete, with no .single() to turn a miss into an error',
  consequence: 'a delete that crossed owners would remove a stranger’s work; one that refused BY NAME would confirm the row exists to somebody with no right to know',
  parity: 'match',

  setup: {
    sqlite: `${secondUser.sqlite}\n${existingCustomReport.sqlite}`,
    postgres: `${secondUser.postgres}\n${existingCustomReport.postgres}`,
  },

  command: {
    verb: 'delete_custom_report',
    payload: { id: EXISTING_REPORT, user_id: STRANGER },
  },

  expect: { outcome: 'ok' },

  result: { deleted: 0 },

  state: [
    customReportsOwnedBy(USER, '1'),
    customReportsOwnedBy(STRANGER, '0'),
    customReportShape(EXISTING_REPORT, 'Where it went:last quarter:1'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
