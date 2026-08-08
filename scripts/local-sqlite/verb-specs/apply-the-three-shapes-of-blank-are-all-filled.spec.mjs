import { USER, WEEKLY_SHOP, BLANK_ROW, NULL_ROW, SPACES_ROW, FILED_ROW, GUESSED_ROW,
  EVERYDAY, everyShapeOfFiling, filingBoard, auditShape, balanceOf,
  balanceIdentityHolds } from './_shared.mjs';

// `category IS NULL OR btrim(category) = ''` — three shapes of "not
// categorised", and the fixture carries all three because a port that tested
// only `= ''` (or only `IS NULL`) would pass on a fixture with one of them. The
// whitespace row is not a curiosity: an import that writes a padded field
// produces exactly it.
//
// The two rows that are already filed are the promise the feature rests on:
// "a race could silently overwrite a category the user set elsewhere — the one
// thing this feature promises never to do". Both are named in the payload and
// both are left exactly as they were, including the guess, which this verb has
// no business confirming.
export default {
  invariant: 'TS-M3',
  title: 'blank, NULL and whitespace are all "not categorised"; anything filed is left alone',
  design: 'apply_category_to_uncategorized 20260808100000:401-406 — the fill-blanks guard, enforced server-side',
  consequence: 'a stale client list overwrites a category the user chose on another device',
  parity: 'match',

  setup: everyShapeOfFiling,
  command: {
    verb: 'apply_category_to_uncategorized',
    payload: { ids: [BLANK_ROW, NULL_ROW, SPACES_ROW, FILED_ROW, GUESSED_ROW], category: WEEKLY_SHOP, user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { id: BLANK_ROW, category: WEEKLY_SHOP, category_confirmed: true },

  state: [
    filingBoard('Blank=Weekly shop/vouched | Null=Weekly shop/vouched | Spaces=Weekly shop/vouched | Filed=Weekly shop/vouched | Guessed=Weekly shop/guess'),
    auditShape('transaction/update,transaction/update,transaction/update'),
    balanceOf(EVERYDAY, '-30.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
