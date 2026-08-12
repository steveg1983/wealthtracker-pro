import {
  USER, EVERYDAY, WEEKLY_SHOP, OLDER_REPORT, NEWER_REPORT, OPENED_SECOND,
  twoCustomReports, listedCustomReport, balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-1',
  title: 'the reports come back oldest first, with both blobs as JSON values rather than strings',
  design: "planningService.getCustomReports: .select('*').eq('user_id', …).order('created_at', { ascending: true }). The two blobs are jsonb in the cloud and TEXT holding JSON in a file, so the crate parses before it answers and the wire carries a value either way",
  consequence: 'a report answered as a JSON STRING containing JSON reads back as "not an array" and draws nothing — silently, because no constraint on either engine looks inside these columns',
  parity: 'match',

  setup: twoCustomReports,
  command: { verb: 'list_custom_reports', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    custom_reports: [
      // The bare row a person gets by pressing Save on an empty builder. It is
      // first because it is oldest, and it is here because the two NOT NULL
      // columns' defaults are exactly what it exercises.
      listedCustomReport({ id: OLDER_REPORT, name: 'Nothing in it yet' }),
      listedCustomReport({
        id: NEWER_REPORT,
        name: 'Where it went',
        description: 'last quarter',
        components: [
          { id: 'one', type: 'summary-stats', title: 'Key figures', config: { metrics: ['income'] }, width: 'full' },
        ],
        filters: {
          dateRange: 'quarter',
          accounts: [EVERYDAY],
          categories: [WEEKLY_SHOP],
          tags: ['holiday'],
        },
        created_at: OPENED_SECOND,
        updated_at: OPENED_SECOND,
      }),
    ],
  },
  state: [balanceIdentityHolds(EVERYDAY), auditRowsInTotal('0')],
};
