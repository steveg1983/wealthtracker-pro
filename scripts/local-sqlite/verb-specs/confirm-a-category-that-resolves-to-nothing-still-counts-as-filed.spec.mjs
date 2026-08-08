import { USER, GUESSED_ROW, everyShapeOfFiling, setups, storedFlag, storedText,
  auditRowsForUpdate } from './_shared.mjs';

// MEASURED. The guard is a BLANKNESS test, not an existence test, so a row filed
// under a category that has since been deleted is still "filed" and confirming
// it records that the user agreed with a dangling id.
//
// That is deliberate at the schema level — R-3 keeps `transactions.category` a
// TEXT column with no foreign key precisely so 'transfer-in' and 'transfer-out'
// keep resolving — so a port that demanded the category exist would refuse to
// confirm every transfer in the file.
export default {
  invariant: 'R-3',
  title: 'a category id that names nothing is still something to agree with',
  design: 'confirm_transaction_categories 20260808100000:458-460 — btrim(category) <> \'\', and nothing else',
  consequence: 'a port checks the category exists, and every legacy transfer sentinel becomes impossible to confirm',
  parity: 'match',

  setup: setups(everyShapeOfFiling, {
    sqlite: `UPDATE transactions SET category = 'transfer-out' WHERE id = '${GUESSED_ROW}';`,
    postgres: `UPDATE public.transactions SET category = 'transfer-out' WHERE id = '${GUESSED_ROW}';`,
  }),
  command: { verb: 'confirm_transaction_categories', payload: { ids: [GUESSED_ROW], user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    storedFlag(GUESSED_ROW, 'category_confirmed', 'yes'),
    storedText(GUESSED_ROW, 'category', 'transfer-out'),
    auditRowsForUpdate(GUESSED_ROW, '1'),
  ],
};
