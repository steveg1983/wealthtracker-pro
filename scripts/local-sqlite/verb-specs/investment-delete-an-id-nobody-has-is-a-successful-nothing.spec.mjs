import {
  USER, EVERYDAY, twoHoldings, holdingsOwnedBy, auditRowsInTotal, balanceIdentityHolds,
} from './_shared.mjs';

// No `.single()` on the writer's delete, so an id naming nothing is a SUCCESSFUL
// NOTHING — the seam's rule for `deleteBudget` and `deleteGoal`, word for word:
// *"a double-click, or a second device that got there first, must not turn a
// decision into an error message."*
export default {
  invariant: 'B-3',
  title: 'deleting a holding that has already gone is done, not an error',
  design: 'InvestmentService.remove:305-309 — .delete() with no .single(), so PostgREST reports zero rows rather than PGRST116',
  consequence: 'the confirm dialog can be answered twice, and a second device that got there first must not make the first look broken',
  parity: 'match',

  setup: twoHoldings,
  command: {
    verb: 'delete_investment',
    payload: { id: 'd0000000-0000-0000-0000-0000000000ff', user_id: USER },
  },

  expect: { outcome: 'ok' },
  result: { deleted: 0 },

  state: [
    holdingsOwnedBy(USER, '2'),
    // A delete of nothing is not a change, so it writes no entry either.
    auditRowsInTotal('0'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
