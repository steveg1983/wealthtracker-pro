import { USER, MERGE_SOURCE, MERGE_TARGET, THEIR_SPLIT_PARENT, mergeablePair, secondUser,
  myLineOnTheirParent, filedUnderTheSource, setups, categoryShape, filedAs,
  auditShape, referencesTo, balanceIdentityHolds, EVERYDAY, SOMEONE_ELSES_ACCOUNT } from './_shared.mjs';

// The seventeenth refusal, and the one the migration wrote as a tripwire rather
// than as a rule: "if a reference surface is ever added and this function is not
// taught about it, the merge fails loudly here instead of orphaning that
// reference silently."
//
// It is REACHABLE today, and finding the route was most of the work of porting
// this verb. Every surface is moved with the same predicate the final check
// uses — except one. The lines loop walks PARENTS scoped by
// transactions.user_id; the final check scans LINES scoped by
// transaction_splits.user_id. A line this user owns on a parent somebody else
// owns therefore survives the move and trips the check.
//
// What makes it a good tripwire is the rollback: the Corner shop row IS moved by
// the transactions loop and then put back, so this spec fails loudly if the port
// ever stops being atomic.
export default {
  invariant: 'C-13',
  title: 'a reference the loops could not reach aborts the whole merge, moves included',
  design: 'merge_categories 20260805214322:352-371 — the five EXISTS checks, raised BEFORE the delete',
  consequence: 'the category is deleted while something still points at it, which is the orphan the whole function exists to prevent',
  parity: 'match',

  setup: setups(mergeablePair, secondUser, myLineOnTheirParent, filedUnderTheSource),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'refused', error: 'merge_left_references' },

  state: [
    categoryShape(MERGE_SOURCE, 'Food shopping:expense:detail:0002:-:active'),
    // Rolled back: the transactions loop had already moved this row.
    filedAs('70000000-0000-0000-0000-000000000001', 'Food shopping/Food shopping'),
    referencesTo(MERGE_SOURCE, '2'),
    auditShape('NONE'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(SOMEONE_ELSES_ACCOUNT),
  ],
};
