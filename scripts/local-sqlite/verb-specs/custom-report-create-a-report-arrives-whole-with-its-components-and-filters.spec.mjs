import {
  USER, EVERYDAY, WEEKLY_SHOP, balanceIdentityHolds, customReportShape,
  customReportFilter, customReportsOwnedBy,
} from './_shared.mjs';

const NEW = 'd0000000-0000-0000-0000-0000000000f1';

// The two jsonb columns are the whole of what a report IS, and nothing in either
// engine constrains what is inside them — no CHECK, no type, no foreign key. So
// a writer that dropped, reordered or re-encoded them would be caught by nothing
// at all until somebody opened the report and found it drawing something else.
// This is the spec that would catch it.
export default {
  invariant: 'B-3',
  title: 'a report is stored with its components and filters exactly as they were sent',
  design: 'planningService.createCustomReport — customReportToDb writes `components` and `filters` as VALUES, never as strings',
  consequence: 'a report is a question somebody wrote down; a component silently dropped on the way in is a report that opens and answers a different question, under the title they gave it',
  parity: 'match',

  command: {
    verb: 'create_custom_report',
    payload: {
      id: NEW,
      user_id: USER,
      name: 'Where it went',
      description: 'last quarter',
      components: [
        { id: 'one', type: 'summary-stats', title: 'Key figures', config: { metrics: ['income'] }, width: 'full' },
        { id: 'two', type: 'pie-chart', title: 'By category', config: { limit: 10 }, width: 'half' },
      ],
      filters: {
        dateRange: 'quarter',
        accounts: [EVERYDAY],
        categories: [WEEKLY_SHOP],
        // A LABEL, not an id. It has to come through character for character.
        tags: ['holiday'],
      },
    },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    created_at: 'the instant of the write, on two clocks and in two transactions — neither was stated',
    updated_at: 'the same instant, and the same two clocks',
  },

  result: {
    id: NEW,
    user_id: USER,
    name: 'Where it went',
    description: 'last quarter',
    components: [
      { id: 'one', type: 'summary-stats', title: 'Key figures', config: { metrics: ['income'] }, width: 'full' },
      { id: 'two', type: 'pie-chart', title: 'By category', config: { limit: 10 }, width: 'half' },
    ],
    filters: {
      dateRange: 'quarter',
      accounts: [EVERYDAY],
      categories: [WEEKLY_SHOP],
      tags: ['holiday'],
    },
  },

  state: [
    customReportsOwnedBy(USER, '1'),
    customReportShape(NEW, 'Where it went:last quarter:2'),
    // The ORDER inside the filter lists is preserved, which is what makes a
    // later replace observable as a replace.
    customReportFilter(NEW, 'accounts', EVERYDAY),
    customReportFilter(NEW, 'tags', 'holiday'),
    // A report moves no money, and this is where that is asserted rather than
    // assumed: every verb spec in this suite ends on B-1.
    balanceIdentityHolds(EVERYDAY),
  ],
};
