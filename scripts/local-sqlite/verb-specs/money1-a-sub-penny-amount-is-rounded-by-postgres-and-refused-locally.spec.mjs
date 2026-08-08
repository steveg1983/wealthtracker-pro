import {
  USER, EVERYDAY, OPENING_BALANCE,
  balanceOf, balanceIdentityHolds, rowsInAccount, auditRowsInTotal, storedAmount,
} from './_shared.mjs';

const NEW_ROW = '70000000-0000-0000-0000-0000000000a8';

// A DECLARED DIVERGENCE, and the first one this verb produces.
//
// Measured on the reference cluster, 2026-08-08:
//   create_transaction_atomic('{"amount":"-12.345",…}')
//     → amount  = -12.35
//     → balance = -12.35
// `transactions.amount` is numeric(20,2), so Postgres rounds half-away-from-zero
// and says nothing at all. The user asked to record 12.345 and the ledger
// recorded 12.35, with no error, no warning and no audit note that a rounding
// happened.
//
// The local edition refuses. DESIGN.md §3.1 states the principle on the
// quantity ceiling — *"the local edition refuses to write it rather than
// silently rounding"* — and this is the same rule one column over.
//
// THE PART THAT NEEDS SAYING OUT LOUD: this also diverges from the TypeScript
// money boundary. `src/utils/decimal.ts:69-80` (parseMoneyInput, TS-M1 /
// canonical #131) rounds ROUND_HALF_UP to 2 dp and returns a number, so the
// cloud client rounds too. PHASE1-PLAN §3.2 note 3 says the `Money` newtype
// makes #131 "structural"; it cannot, because a newtype that refuses does not
// implement a rule that rounds. Two documents disagree, the design's principle
// wins here, and this spec is where the disagreement is visible instead of
// buried.
export default {
  invariant: 'MONEY-1',
  title: 'three decimal places: Postgres rounds it away silently, the local file refuses it',
  design: 'DESIGN.md §3.1 (refuse rather than round); numeric(20,2) at initial-schema.sql:439; src/utils/decimal.ts:69-80 rounds too',
  consequence: 'silent rounding is money changing on the way in — small, permanent, and invisible in the audit log because the audit records the rounded figure as if it were what was asked for',
  parity: 'divergent',
  reason:
    'Postgres stores -12.35 and moves the balance by -12.35 with no error, because the column is numeric(20,2). '
    + 'The local Money boundary refuses the input instead, so nothing is written. DECIDED, not accidental: DESIGN.md §3.1. '
    + 'The divergence must be resolved on the cloud side (reject or report the rounding) before an importer can rely on either behaviour.',

  command: {
    verb: 'create_transaction',
    payload: {
      id: NEW_ROW,
      user_id: USER,
      account_id: EVERYDAY,
      description: 'Three decimal places',
      amount: '-12.345',
      type: 'expense',
      date: '2024-03-02',
    },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'amount_not_representable' },
    postgres: { outcome: 'ok' },
  },

  state: [
    storedAmount(NEW_ROW, { sqlite: 'ABSENT', postgres: '-12.35' }),
    balanceOf(EVERYDAY, { sqlite: OPENING_BALANCE, postgres: '-37.35' }),
    // Both engines are still internally consistent. That is what makes the
    // rounding dangerous: nothing is broken, the figure is just not the one
    // the caller sent.
    balanceIdentityHolds(EVERYDAY),
    rowsInAccount(EVERYDAY, { sqlite: '1', postgres: '2' }),
    auditRowsInTotal({ sqlite: '0', postgres: '1' }),
  ],
};
