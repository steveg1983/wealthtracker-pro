import {
  USER, EVERYDAY, CORNER_SHOP, RAINY_DAY, WEEKLY_SHOP,
  enriched, balanceOf, balanceIdentityHolds, storedText, storedFlag, storedTags,
} from './_shared.mjs';

// BEHAVIOUR CLASS 1 OF 4: the key is not there at all.
//
// This is the one row of AUDIT3 §1's table that is uniform — absent means
// "leave it alone" for all fifteen settable fields, with no exceptions. It is
// also the row that is easiest to break, because a port that builds its UPDATE
// from a struct of `Option<T>` gets it right by accident for `None` and wrong
// for everything else.
//
// So the payload changes ONE field and this spec checks that the other fourteen
// came through untouched, on a row where every one of them holds a value worth
// losing. Without `enriched` most of them start NULL and "left alone" and
// "cleared" are indistinguishable.
export default {
  invariant: 'TS-T3',
  title: 'changing one field leaves the other fourteen exactly as they were',
  design: 'update_transaction_atomic 20260808100000:305-334 — every SET expression ends ELSE <column>',
  consequence: 'an edit that renamed a payee would silently clear the notes, the category, the merchant and the transfer link on the same row',
  parity: 'match',

  setup: enriched,

  command: {
    verb: 'update_transaction',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      patch: { description: 'Corner shop, renamed' },
    },
  },

  expect: { outcome: 'ok' },
  result: {
    description: 'Corner shop, renamed',
    amount: '-25.00',
    type: 'expense',
    date: '2024-03-01',
    account_id: EVERYDAY,
    category: WEEKLY_SHOP,
    category_id: WEEKLY_SHOP,
    notes: 'a note',
    merchant_name: 'a merchant',
    transfer_account_id: RAINY_DAY,
    is_cleared: true,
    is_recurring: true,
    // Renaming a payee says nothing about whether the category was checked, so
    // the provenance flag stays where it was. Branch 3 of the three-way CASE.
    category_confirmed: false,
    metadata: { k: 1 },
    tags: ['one', 'two'],
  },

  state: [
    // No amount moved, so no balance moved.
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    storedText(CORNER_SHOP, 'notes', 'a note'),
    storedText(CORNER_SHOP, 'merchant_name', 'a merchant'),
    storedText(CORNER_SHOP, 'transfer_account_id', RAINY_DAY),
    storedText(CORNER_SHOP, 'category_id', WEEKLY_SHOP),
    storedFlag(CORNER_SHOP, 'is_cleared', 'yes'),
    storedFlag(CORNER_SHOP, 'category_confirmed', 'no'),
    storedTags(CORNER_SHOP, 'one,two'),
  ],
};
