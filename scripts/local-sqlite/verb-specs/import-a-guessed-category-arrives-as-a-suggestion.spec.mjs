import {
  USER, EVERYDAY, WEEKLY_SHOP, balanceIdentityHolds, importedRow,
} from './_shared.mjs';

// The owner's own complaint, quoted in 20260808100000:12-16: "The system does
// not pre-populate the category. I thought it was a good idea [but] you then get
// a bit confused as to whether you need to check a part of the list or not."
//
// On the FILE path the decision is the caller's: a category the file STATED is
// the user's own data and arrives confirmed; one the smart categoriser guessed
// arrives as a suggestion. Both carry the category and both count in every
// report — the flag records who decided, never what was decided.
export default {
  invariant: 'D-7',
  title: 'a category the importer guessed is stored as a suggestion and one the file stated is not',
  design: 'import_transactions_atomic 20260808140000:347 — COALESCE((r->>\'category_confirmed\')::boolean, true); the reasoning is 20260808100000:178-182',
  consequence: 'a guess that looks identical to a choice means the register cannot answer the only question that matters after an import: which of these have I actually checked?',
  parity: 'match',

  command: {
    verb: 'import_transactions',
    payload: {
      user_id: USER,
      account_id: EVERYDAY,
      rows: [
        { description: 'Guessed', amount: '-1.00', type: 'expense', date: '2024-05-01',
          category: WEEKLY_SHOP, category_confirmed: false },
        { description: 'Stated', amount: '-1.00', type: 'expense', date: '2024-05-01',
          category: WEEKLY_SHOP },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { inserted: 2, skipped: 0, idempotent: false },

  state: [
    importedRow('Guessed', 'Weekly shop | confirmed=no | cleared=no | seq=-'),
    importedRow('Stated', 'Weekly shop | confirmed=yes | cleared=no | seq=-'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
