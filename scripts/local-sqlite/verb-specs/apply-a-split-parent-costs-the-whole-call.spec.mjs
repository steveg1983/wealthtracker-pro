import { USER, WEEKLY_SHOP, CORNER_SHOP, BLANK_ROW, NULL_ROW, EVERYDAY,
  everyShapeOfFiling, plainSplitParent, setups, filingBoard, filedAs,
  splitLines, auditShape, balanceOf, balanceIdentityHolds } from './_shared.mjs';

// THE TRIPWIRE, FLIPPED — the second time this exact thing has happened, and
// the second time this file has been rewritten by its own repair. The name is
// kept: `costs-the-whole-call` is what it USED to measure, and losing the name
// would lose the thread between the regression and the fix.
//
// What happened, traced through the migrations:
//
//   20260708100000:200      the original fan-out: fill every named row that is
//                           still blank, one audit entry each.
//   20260713100000:275      adds `AND NOT is_split` and explains it at :268-273:
//                           "A split parent's category is blank BY DESIGN —
//                           without this guard the fan-out would treat it as
//                           uncategorised and stamp a single category onto it
//                           (the trigger above would reject the write mid-loop
//                           and fail the whole propagation)."
//   20260808100000:387      "identical to 20260708100000 except that the rows it
//                           fills are marked CONFIRMED" — a true sentence and
//                           the wrong base. 20260708100000 had not been the live
//                           definition for nearly a month; 20260713100000 had.
//                           The guard went with the bathwater.
//   20260808180000:230      puts it back.
//
// MEASURED on the reference cluster, 2026-08-08, both ways
// (probe-apply-category.sql):
//
//   BEFORE  ids = [blank, THE SPLIT PARENT, blank]
//             -> ERROR split_category_locked, NEITHER blank row filed, audit
//                log EMPTY. Not one row skipped: a bulk action that did nothing
//                and reported a raw internal code.
//   AFTER   the same call -> 2 filed, 2 audit rows, the parent untouched.
//           the parent ALONE -> 0, and no error.
//
// This file asserted the BEFORE on purpose, on the argument that a documented
// shared defect beats two editions disagreeing about what a call did. That
// argument expires the moment the cloud is repaired, exactly as it expired for
// `is_cleared` when 20260808150000 landed — and the two are the same mistake,
// three days apart, in two different functions.
//
// So it now asserts the behaviour both engines SHOULD have and both engines DO
// have: the split parent is SKIPPED, silently, and every other row the caller
// named is filed.
//
// Scope, stated plainly: "postgres" here is the reference cluster, which
// scripts/local-db/up.sh rebuilds from the full migration history including the
// new file. PRODUCTION still loses the whole call until the owner applies it.
// That order is deliberate — the differential proof is what makes applying it
// safe — and this spec is what will keep saying so if the repair is ever
// rebased away a third time.
export default {
  invariant: 'S-5',
  title: 'one split parent in the list is skipped, and every other row in it is still filed',
  design: 'apply_category_to_uncategorized 20260808180000:230-262 — the cursor\'s `AND NOT is_split`, added at 20260713100000:293, dropped by 20260808100000:387, restored',
  consequence: 'without it a stale list containing one row that has become a split files NOTHING at all and shows the user a raw code — the whole propagation lost for one row',
  parity: 'match',

  setup: setups(everyShapeOfFiling, plainSplitParent),
  command: {
    verb: 'apply_category_to_uncategorized',
    payload: { ids: [BLANK_ROW, CORNER_SHOP, NULL_ROW], category: WEEKLY_SHOP, user_id: USER },
  },
  expect: { outcome: 'ok' },

  state: [
    // The two rows that were fine are filed and vouched for. The two that were
    // already filed are left exactly as they were, which is the promise the
    // whole feature rests on.
    filingBoard('Blank=Weekly shop/vouched | Null=Weekly shop/vouched | Spaces=EMPTY/guess | Filed=Weekly shop/vouched | Guessed=Weekly shop/guess'),
    // The split parent: still blank, still split, its lines untouched. Skipped
    // means skipped — not written, not refused, not audited.
    filedAs(CORNER_SHOP, 'EMPTY/NULL'),
    splitLines(CORNER_SHOP, '0:-15.00:Weekly shop:-:-:- | 1:-10.00:Weekly shop:-:-:-'),
    // Two rows filed, two audit rows. A third would mean the parent was written.
    auditShape('transaction/update,transaction/update'),
    // Balance-neutral: this verb writes category, category_confirmed and
    // updated_at, and nothing else.
    balanceOf(EVERYDAY, '-30.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
