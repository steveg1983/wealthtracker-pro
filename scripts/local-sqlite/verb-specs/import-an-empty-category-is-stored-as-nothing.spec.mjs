import {
  USER, EVERYDAY, balanceIdentityHolds, importedText,
} from './_shared.mjs';

// The asymmetry that is easiest to lose, because the two functions look alike:
// `create_transaction_atomic` stores `category` and `notes` VERBATIM, empty
// string included, and this one wraps both in NULLIF. A port that shared one
// insert helper between them would silently pick one behaviour for both.
//
// It matters downstream: `category IS NULL OR btrim(category) = ''` is what
// apply_category_to_uncategorized selects on, so an imported row carrying `''`
// and one carrying NULL land in the same bucket either way — but
// `confirm_transaction_categories` guards on `category IS NOT NULL AND btrim(…)
// <> ''`, and `verify_integrity`'s dangling-category check reads the column
// directly.
export default {
  invariant: 'D-7',
  title: 'an empty category and an empty note become nothing at all, unlike the create verb',
  design: 'import_transactions_atomic 20260808140000:339-340 — NULLIF(r->>\'category\',\'\'); compare create_transaction_atomic 20260808150000, which does not',
  consequence: 'two spellings of "uncategorised" in one column means every screen that asks the question has to ask it twice, and one of them will forget',
  parity: 'match',

  command: {
    verb: 'import_transactions',
    payload: {
      user_id: USER,
      account_id: EVERYDAY,
      rows: [
        { description: 'Probe', amount: '-1.00', type: 'expense', date: '2024-05-01',
          category: '', notes: '' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 1, skipped: 0, idempotent: false },

  state: [
    importedText('Probe', 'category', 'NULL'),
    importedText('Probe', 'notes', 'NULL'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
