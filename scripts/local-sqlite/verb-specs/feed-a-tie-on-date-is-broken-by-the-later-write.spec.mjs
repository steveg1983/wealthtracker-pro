import {
  USER, FED, aFeedCreatedAccount, aPayeeTiedOnDate, setups,
  balanceIdentityHolds, fedRow,
} from './_shared.mjs';

// Tie-break 2 of 2 — and the LAST one the cloud states. Both rows are dated the
// same day and filed under different categories, so only `created_at` can
// separate them.
//
// Below this the cloud has no rule at all, and its answer there is an artefact
// of the plan's grouping order rather than a decision: MEASURED, and repeatable,
// but neither id order nor insert order. The local port therefore adds
// `category ASC` as a fourth key — a strengthening where the cloud has no rule —
// and no spec constructs a total tie, because a spec that did would be asserting
// the artefact. This one is the deepest tie that has a right answer.
export default {
  invariant: 'I-6',
  title: 'when two filings share a payee, a count and a date, the one written later wins',
  design: 'payee_memory_category 20260722140000:41 — MAX(t.created_at) DESC, the last ordering key the cloud states',
  consequence: 'two rows imported on one day under different categories otherwise leave the answer to the planner',
  parity: 'match',

  setup: setups(aFeedCreatedAccount, aPayeeTiedOnDate),
  command: {
    verb: 'import_bank_transactions',
    payload: {
      user_id: USER,
      rows: [
        { user_id: USER, account_id: FED, description: 'BIG SHOP', amount: '-9.00',
          type: 'expense', date: '2024-05-01', external_transaction_id: 'n-1' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 1, skipped: 0 },

  state: [
    fedRow('n-1', 'Groceries | confirmed=no | cleared=no'),
    balanceIdentityHolds(FED),
  ],
};
