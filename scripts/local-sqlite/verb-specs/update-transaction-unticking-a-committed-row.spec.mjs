import { USER, EVERYDAY, COMMITTED_ROW, everyStateOfCommitment,
  storedFlag, storedTriFlag, balanceIdentityHolds } from './_shared.mjs';

// THE DIVERGENCE THE C/R SPLIT CREATES, measured rather than discovered later.
//
// `is_reconciled` implies `is_cleared`. The cloud keeps that rule in ONE
// function — set_transactions_cleared's CASE — and its own migration ships a
// verification query (7) whose whole job is to go and find rows in the state
// nothing stops the update RPC from producing. `update_transaction_atomic` sets
// is_cleared from the patch and never touches is_reconciled, so unticking a
// committed row leaves exactly that pair behind.
//
// The local file makes the rule structural, so the same call is refused by
// `transactions_reconciled_implies_cleared` and the row is left as it was. That
// is DESIGN.md §6's argument applied to the newest column in the schema: a rule
// enforced in one writer is a rule the next writer skips.
//
// WHAT IT MEANS FOR THE REGISTER, recorded here because slice 27 is what will
// meet it: there is no `unreconcile` operation in the seam on EITHER engine, so
// the local answer is "a committed row stays ticked" — which is Money's own
// behaviour, and which the tick affordance has to know before it offers itself.
// The way to un-tick a committed row locally is to unmark it through
// `set_transactions_cleared`, which clears both flags in one statement and is
// accepted.
export default {
  invariant: 'A-1',
  title: 'unticking a committed row: the cloud stores the pair its own verification hunts for, the file refuses it',
  design: '20260810200000:130-136 states the rule and :428-433 is the query that looks for breaches of it; update_transaction_atomic 20260808100000:282-375 does not carry it',
  consequence: 'the cleared balance and the reconciled set drift apart permanently, and no screen can tell which is right',
  parity: 'divergent',
  reason: 'the cloud enforces "committed implies marked" inside set_transactions_cleared alone, so an ordinary edit can break it and the migration ships a query to find the rows afterwards; schema.sql makes it a CHECK, so the same edit is refused and the row is unchanged',

  setup: everyStateOfCommitment,
  command: {
    verb: 'update_transaction',
    payload: { id: COMMITTED_ROW, patch: { is_cleared: false }, user_id: USER },
  },
  expect: {
    sqlite: { outcome: 'refused', error: 'transactions_reconciled_implies_cleared' },
    postgres: { outcome: 'ok' },
  },

  state: [
    storedFlag(COMMITTED_ROW, 'is_cleared', { sqlite: 'yes', postgres: 'no' }),
    storedTriFlag(COMMITTED_ROW, 'is_reconciled', 'yes'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
