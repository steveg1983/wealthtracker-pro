import {
  USER, EVERYDAY, OPENING_BALANCE,
  balanceOf, balanceIdentityHolds, rowsInAccount, auditRowsForCreate,
} from './_shared.mjs';

const NEW_ROW = '70000000-0000-0000-0000-0000000000a4';

// A zero-amount row is legal in both engines and moves no money. It is here
// because it is the case that can make a broken `changes()` assert LOOK fine:
// the balance is unchanged either way, so only the row count and the audit row
// distinguish "the UPDATE matched one account and added zero" from "the UPDATE
// matched nothing and nobody checked".
//
// PHASE1-PLAN §4.1 settles what `type` a zero-amount row gets on the IMPORT
// path (the sign decides; at exactly zero the source's hint decides; with no
// hint, `expense`). That decision belongs to `import_transactions`, not here:
// this verb is told the type and stores it.
export default {
  invariant: 'B-2',
  title: 'a zero-amount row is accepted, moves nothing, and still has to hit exactly one account',
  design: 'DESIGN.md §1.1 B-2; PHASE1-PLAN §4.1 for the import-path type decision, which is a different verb',
  consequence: 'this is the case where a missing changes() assert looks harmless — the balance is right by accident',
  parity: 'match',

  command: {
    verb: 'create_transaction',
    payload: {
      id: NEW_ROW,
      user_id: USER,
      account_id: EVERYDAY,
      description: 'Invented zero-value adjustment',
      amount: '0.00',
      type: 'expense',
      date: '2024-03-02',
    },
  },

  expect: { outcome: 'ok' },
  result: { amount: '0.00' },

  state: [
    balanceOf(EVERYDAY, OPENING_BALANCE),
    balanceIdentityHolds(EVERYDAY),
    rowsInAccount(EVERYDAY, '2'),
    auditRowsForCreate(NEW_ROW, '1'),
  ],
};
