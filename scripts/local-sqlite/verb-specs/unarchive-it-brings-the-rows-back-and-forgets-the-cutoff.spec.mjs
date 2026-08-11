import { USER, EVERYDAY, COMMITTED_ROW, PRE_SPLIT_ROW, MARKED_ROW,
  everyStateOfCommitment, archivedThroughFebruary, setups,
  storedFlag, archivedRowsIn, accountText, auditShape,
  balanceOf, balanceIdentityHolds } from './_shared.mjs';

// "One click, because nothing ever left." The rows come back and the account's
// cutoff is cleared in the same call — both halves matter, because a cutoff left
// behind would have the sweep re-hide every row the next time one was committed.
//
// The setup archives two rows by hand rather than by calling the archive verb,
// so this spec measures ONE operation. `audit_shape` is NONE for
// `archive_transactions_before`'s reason: neither of the two bulk archive RPCs
// writes an audit row, and the port reproduces the RPC rather than tidying it.
export default {
  invariant: 'A-4',
  title: 'unarchiving brings the rows back and forgets the cutoff',
  design: 'unarchive_account 20260721130000:92-114 — untouched by the marking migration',
  consequence: 'history stays hidden, or comes back only to be swept away again by a cutoff nobody cleared',
  parity: 'match',

  setup: setups(everyStateOfCommitment, archivedThroughFebruary, {
    sqlite: `UPDATE transactions SET archived = 1
              WHERE id IN ('${COMMITTED_ROW}', '${PRE_SPLIT_ROW}');`,
    postgres: `UPDATE public.transactions SET archived = true
                WHERE id IN ('${COMMITTED_ROW}', '${PRE_SPLIT_ROW}');`,
  }),
  command: { verb: 'unarchive_account', payload: { account_id: EVERYDAY, user_id: USER } },
  expect: { outcome: 'ok' },
  result: { unarchived: 2 },

  state: [
    storedFlag(COMMITTED_ROW, 'archived', 'no'),
    storedFlag(PRE_SPLIT_ROW, 'archived', 'no'),
    storedFlag(MARKED_ROW, 'archived', 'no'),
    archivedRowsIn(EVERYDAY, '0'),
    accountText(EVERYDAY, 'archive_through_date', 'NULL'),
    auditShape('NONE'),
    balanceOf(EVERYDAY, '-28.00'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
