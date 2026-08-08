import { USER, GUESSED_ROW, WEEKLY_SHOP, EVERYDAY, everyShapeOfFiling,
  storedText, storedFlag, storedAmount, filedAs, balanceOf,
  balanceIdentityHolds, auditRowsForUpdate } from './_shared.mjs';

// The safety property is an ABSENCE: "It takes NO category argument […] so this
// function is incapable of changing a category (let alone an amount) no matter
// who calls it or what they pass."
//
// The same shape as verbs/mod.rs's note about set_account_balance — the
// guarantee comes from the argument that is not there, and survives every future
// edit that does not re-add one. So the assertions are about everything that did
// NOT move: the category, the amount, the account's balance. The unit test in
// the verb covers the other half by proving a `category` key on the wire is
// refused rather than ignored.
export default {
  invariant: 'TS-M3',
  title: 'confirming changes one boolean and nothing else about the row',
  design: 'confirm_transaction_categories 20260808100000:426-435 and :463-467 — the SET list is one column',
  consequence: 'a "confirm" affordance becomes a way to edit a category, and the audit entry calls it agreement',
  parity: 'match',

  setup: everyShapeOfFiling,
  command: { verb: 'confirm_transaction_categories', payload: { ids: [GUESSED_ROW], user_id: USER } },
  expect: { outcome: 'ok' },
  result: { id: GUESSED_ROW, category: WEEKLY_SHOP, category_confirmed: true, amount: '-1.00' },

  state: [
    storedFlag(GUESSED_ROW, 'category_confirmed', 'yes'),
    storedText(GUESSED_ROW, 'category', WEEKLY_SHOP),
    filedAs(GUESSED_ROW, 'Weekly shop/NULL'),
    storedAmount(GUESSED_ROW, '-1.00'),
    balanceOf(EVERYDAY, '-30.00'),
    balanceIdentityHolds(EVERYDAY),
    auditRowsForUpdate(GUESSED_ROW, '1'),
  ],
};
