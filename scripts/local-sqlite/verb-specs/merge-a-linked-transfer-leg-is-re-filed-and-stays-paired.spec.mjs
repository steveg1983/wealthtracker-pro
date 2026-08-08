import { USER, MERGE_SOURCE, MERGE_TARGET, CORNER_SHOP, LEG_COUNTERPART, LEG_LINE,
  EVERYDAY, RAINY_DAY, mergeablePair, linkedLegUnderTheSource, setups,
  categoryShape, splitLines, splitSumHolds, splitLineState, legPairsAreMutual,
  transferShape, auditShape, balanceOf, balanceIdentityHolds } from './_shared.mjs';

// THE GUARD SPEC. The merge re-files `transaction_splits.category`, and in the
// local schema that column is one of the four trg_protect_linked_leg watches
// (S-9) — because schema.sql deliberately turned the cloud's PROCEDURAL leg
// rules into triggers, "so a future code path that forgets them still cannot
// break the pair". This is that future code path.
//
// MEASURED, both engines: Postgres re-files a linked leg happily and the pair
// survives; SQLite raises `split_leg_locked` unless the verb holds
// _rpc_guard('leg') across the line UPDATE. Without the guard the local edition
// refuses a merge the cloud performs — and refuses it for the commonest split
// shape in the owner's own data (86 of 364 imported lines are legs filed under
// ordinary categories).
//
// The pairing assertions are the point of holding the guard NARROWLY: the leg is
// re-filed, and everything the guard stands down for stays exactly as it was —
// same amount, same target account, same counterpart, still mutual.
export default {
  invariant: 'S-9',
  title: 'a merge re-files a linked transfer leg without breaking the pair',
  design: 'merge_categories 20260805214322:264-268 against schema.sql S-9 trg_protect_linked_leg',
  consequence: 'the local edition refuses a merge the cloud performs, for every account whose splits contain a transfer',
  parity: 'match',

  setup: setups(mergeablePair, linkedLegUnderTheSource),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    categoryShape(MERGE_SOURCE, 'GONE'),
    // Re-filed; amount, target and link untouched.
    splitLines(CORNER_SHOP, '0:-15.00:Groceries:0002:linked:- | 1:-10.00:Weekly shop:-:-:-'),
    splitLineState(LEG_LINE, 'linked'),
    transferShape(LEG_COUNTERPART, 'transfer:-:0001:-:0001'),
    legPairsAreMutual(),
    splitSumHolds(CORNER_SHOP),
    auditShape('category/delete,transaction/update'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
  ],
};
