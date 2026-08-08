import { USER, MERGE_SOURCE, MERGE_TARGET, THEIR_ROW, mergeablePair, secondUser,
  strangersRow, setups, categoryShape, filedAs, auditShape,
  balanceIdentityHolds, SOMEONE_ELSES_ACCOUNT } from './_shared.mjs';

// What a merge does NOT do, MEASURED rather than reasoned. Both loops and the
// final EXISTS check are scoped by v_owner, so another login's row filed under
// this login's category is neither moved nor noticed: its TEXT column keeps a
// dangling id, and its uuid column is nulled by the foreign key — unaudited,
// because that is the database doing it and not the verb.
//
// Nothing here fixes that, for the reason clear_transfer_links gives about
// reciprocals: the cloud leaves it (RLS makes it unreachable there), and a local
// port that tidied it would touch a row the cloud does not. R-2 is the constraint
// spec for the nulling; this is the verb-level record that the merge relies on it.
export default {
  invariant: 'R-2',
  title: 'a merge leaves another login\'s reference dangling, and the foreign key nulls the twin',
  design: 'merge_categories 20260805214322:352-365 — every EXISTS scoped by v_owner, and the FK at initial-schema transactions.category_id',
  consequence: 'a local port "improves" on the cloud by editing a row the cloud never touches, and the two editions disagree about what a merge did',
  parity: 'match',

  setup: setups(mergeablePair, secondUser, strangersRow, {
    sqlite: `UPDATE transactions SET category = '${MERGE_SOURCE}', category_id = '${MERGE_SOURCE}' WHERE id = '${THEIR_ROW}';`,
    postgres: `UPDATE public.transactions SET category = '${MERGE_SOURCE}', category_id = '${MERGE_SOURCE}'::uuid WHERE id = '${THEIR_ROW}';`,
  }),
  command: { verb: 'merge_categories', payload: { source_id: MERGE_SOURCE, target_id: MERGE_TARGET, user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    categoryShape(MERGE_SOURCE, 'GONE'),
    // The text keeps the dead id (rendered raw, because it resolves to nothing);
    // the uuid is gone.
    filedAs(THEIR_ROW, `${MERGE_SOURCE}/NULL`),
    auditShape('category/delete'),
    balanceIdentityHolds(SOMEONE_ELSES_ACCOUNT),
  ],
};
