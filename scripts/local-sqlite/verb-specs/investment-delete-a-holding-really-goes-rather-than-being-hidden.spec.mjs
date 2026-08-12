import {
  USER, EVERYDAY, LISTED_HOLDING, SECOND_HOLDING, twoHoldings,
  investmentShape, holdingsOwnedBy, balanceIdentityHolds,
} from './_shared.mjs';

// A REAL DELETE, unlike an account's close. `closeAccount` is soft in every
// engine because *"a deleted account is a hole in a ledger"*; a holding is not
// one — no transaction is filed against it and no balance is derived from it.
// The money the position represents lives in the LEDGER (the investment↔cash
// account pair), which this row is a second, clearly-labelled opinion about and
// never a component of.
export default {
  invariant: 'B-3',
  title: 'deleting a holding removes the row, and the account it sat in is untouched',
  design: 'InvestmentService.remove:305-309 — .delete().eq(\'id\',…).eq(\'user_id\',…), with no soft-delete column anywhere in either schema',
  consequence: 'a holding is a second opinion about money the ledger already holds, so removing one must move no balance at all — a store that adjusted an account here would double-count the position it just removed',
  parity: 'match',

  setup: twoHoldings,
  command: { verb: 'delete_investment', payload: { id: LISTED_HOLDING, user_id: USER } },

  expect: { outcome: 'ok' },
  result: { deleted: 1 },

  state: [
    investmentShape(LISTED_HOLDING, 'GONE'),
    investmentShape(
      SECOND_HOLDING,
      'BBBB.L:Another Company plc:5.00000000:250.00:-:-:etf:GBP:-:0001:-'
    ),
    holdingsOwnedBy(USER, '1'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
