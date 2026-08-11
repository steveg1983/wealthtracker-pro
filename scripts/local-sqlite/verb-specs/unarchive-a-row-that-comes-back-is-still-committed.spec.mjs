import { USER, EVERYDAY, COMMITTED_ROW, PRE_SPLIT_ROW,
  everyStateOfCommitment, archivedThroughFebruary, setups,
  storedFlag, storedTriFlag, archivedRowsIn, balanceIdentityHolds } from './_shared.mjs';

// UNARCHIVING IS A DECISION ABOUT WHAT THE REGISTER SHOWS, AND NOTHING ELSE.
//
// The commitment is a fact about a statement that was balanced; bringing a row
// back into view does not un-settle the statement it was reconciled against. A
// verb that cleared `is_reconciled` here would silently re-open every finished
// reconciliation the account has ever had, and the account's own
// `last_reconciled_balance` would then record a figure no set of rows agrees
// with.
//
// The three-valued assertion is what makes this bite: `yes` for the committed
// row and `NULL` for the pre-split one. A port that wrote 0 across the rows it
// touched would leave both reading "explicitly not committed", which
// `storedFlag` could not tell from the second case at all.
//
// The reverse direction is the schema's rather than this verb's: the rows come
// back with `is_reconciled` untouched, so no `AFTER UPDATE OF is_reconciled`
// fires and the sweep cannot re-archive them in the same breath.
export default {
  invariant: 'A-4',
  title: 'a row that comes back out of the archive is still committed',
  design: 'unarchive_account 20260721130000:103-106 — two columns, and is_reconciled is not one of them',
  consequence: 'every finished reconciliation in the account is silently re-opened by a click that was only meant to show the rows again',
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
    storedTriFlag(COMMITTED_ROW, 'is_reconciled', 'yes'),
    storedTriFlag(PRE_SPLIT_ROW, 'is_reconciled', 'NULL'),
    storedFlag(COMMITTED_ROW, 'is_cleared', 'yes'),
    storedFlag(COMMITTED_ROW, 'archived', 'no'),
    archivedRowsIn(EVERYDAY, '0'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
