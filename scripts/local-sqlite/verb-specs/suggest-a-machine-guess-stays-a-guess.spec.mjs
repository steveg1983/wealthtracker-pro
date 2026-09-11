import { USER, WEEKLY_SHOP, BLANK_ROW, everyShapeOfFiling,
  storedFlag, filingBoard, auditRowsForUpdate } from './_shared.mjs';

// The counterpart of apply-filing-a-payee-vouches-for-it, and the two specs
// together are the 11 Sep 2026 ruling in full. The deliberate bulk verb
// vouches, because "payee memory spreading that choice to the identical rows
// IS the choice" — when the user chose the population. Payee memory's
// AUTOMATIC fan-out is the opposite case: the user acted on ONE row and the
// app extrapolated. The owner confirmed one suggestion, watched the payee's
// other rows vanish from To Review unseen, and ruled: the spread is welcome,
// "but they should stay on the 'review list' as I have not reviewed them yet."
//
// So this verb writes the guess shape — category_confirmed false — and SETS
// needs_review true rather than leaving it: every row it touches was blank,
// held in To Review by the unfiled arm, and gaining a category would
// otherwise lift it off the list at the moment it acquires something to check.
export default {
  invariant: 'TS-M3',
  title: 'a machine guess stays a guess, and still wants eyes',
  design: 'suggest_category_to_uncategorized 20260911100000 — category_confirmed = false, needs_review = true',
  consequence: "payee memory's fan-out vouches on the user's behalf and files rows off the review list nobody looked at",
  parity: 'match',

  setup: everyShapeOfFiling,
  command: {
    verb: 'suggest_category_to_uncategorized',
    payload: { ids: [BLANK_ROW], category: WEEKLY_SHOP, user_id: USER },
  },
  expect: { outcome: 'ok' },

  state: [
    storedFlag(BLANK_ROW, 'needs_review', 'yes'),
    // The board carries the provenance half: the blank row now reads
    // Weekly shop/guess, and the four rows the call did not name — including
    // the one a human already vouched for — are exactly as the fixture left
    // them.
    filingBoard('Blank=Weekly shop/guess | Null=NULL/guess | Spaces=EMPTY/guess | Filed=Weekly shop/vouched | Guessed=Weekly shop/guess'),
    auditRowsForUpdate(BLANK_ROW, '1'),
  ],
};
