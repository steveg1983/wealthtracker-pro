import { USER, CORNER_SHOP, EVERYDAY, everyShapeOfFiling, plainSplitParent, setups,
  storedFlag, filedAs, splitLines, auditShape, balanceOf, balanceIdentityHolds } from './_shared.mjs';

// The same property of split parents that costs its sibling verb the whole call
// costs this one nothing: a split parent's category is blank BY DESIGN, and the
// blankness guard excludes it before anything is written.
//
// This verb never lost a guard because it never needed one — the safety is a
// consequence of what it selects, not of a condition somebody remembered to add.
// Read alongside `apply-a-split-parent-costs-the-whole-call`, the pair is the
// argument for writing the selection so that the dangerous rows are the ones it
// does not choose.
export default {
  invariant: 'S-5',
  title: 'a split parent is not a suggestion, so there is nothing here to confirm',
  design: 'confirm_transaction_categories 20260808100000:458-460 against transactions_split_parent_has_blank_category',
  consequence: 'the confirm sweep stamps a split parent and trips the split guard, exactly as its sibling verb does',
  parity: 'match',

  setup: setups(everyShapeOfFiling, plainSplitParent),
  command: { verb: 'confirm_transaction_categories', payload: { ids: [CORNER_SHOP], user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    storedFlag(CORNER_SHOP, 'category_confirmed', 'no'),
    filedAs(CORNER_SHOP, 'EMPTY/NULL'),
    splitLines(CORNER_SHOP, '0:-15.00:Weekly shop:-:-:- | 1:-10.00:Weekly shop:-:-:-'),
    auditShape('NONE'),
    balanceOf(EVERYDAY, '-30.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
