import {
  USER, EXISTING_BUDGET, existingBudget, balanceIdentityHolds, budgetShape, budgetsOwnedBy,
} from './_shared.mjs';

// A REAL delete, which an account never gets: the seam draws that line and gives
// the reason — a budget holds no money and nothing is filed against it, so
// removing one leaves no hole in the ledger.
export default {
  invariant: 'X-6',
  title: 'a delete removes the row rather than deactivating it',
  design: 'planningService.deleteBudget:289-300, against accountService.deleteAccount’s is_active = false',
  consequence: 'a budget that only looked deleted would come back on the next boot, and the delete button would appear not to work',
  parity: 'match',

  setup: existingBudget,

  command: {
    verb: 'delete_budget',
    payload: { id: EXISTING_BUDGET, user_id: USER },
  },

  expect: { outcome: 'ok' },

  result: { deleted: 1 },

  state: [
    budgetShape(EXISTING_BUDGET, 'GONE'),
    budgetsOwnedBy(USER, '0'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
