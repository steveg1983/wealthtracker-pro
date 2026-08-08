import {
  USER, EVERYDAY, OPENING_BALANCE, SOMEONE_ELSES_ACCOUNT, secondUser,
  balanceOf, balanceIdentityHolds, rowsInAccount, auditRowsInTotal, accountExists,
} from './_shared.mjs';

const NEW_ROW = '70000000-0000-0000-0000-0000000000b7';

// R-12'S WEAKEST LINK, AND THE ONE THAT WAS REACHABLE THROUGH A TRUSTED RPC.
//
// Everything else about the ownership pairing needed a raw insert to exploit.
// This did not. `create_transaction_atomic` copies `transfer_account_id`
// straight out of the caller's payload with no ownership check anywhere in the
// function (20260808150000:196), and the Rust port does the same because it is
// a port. So a perfectly ordinary call — the caller's OWN account_id, their own
// amount, their own date — could name a stranger's account as the far side of a
// transfer, and did.
//
// MEASURED on the reference cluster (probe-fk-verbs.sql), which is why this is
// a verb spec rather than one more constraint spec:
//
//     P1  before 20260808170000  -> ACCEPTED, the row lands
//         after                  -> REFUSED, transactions_transfer_account_id_user_fkey
//     P2  the same call with the caller's own second account
//                                -> ACCEPTED, both before and after
//
// P2 is the control and it is why the refusal below can only be about the
// OWNER: the column takes a far side, and takes it from this very payload.
//
// What the far side is FOR is the reason this matters rather than being tidy.
// `create_transfer_counterpart` compares the two accounts' currencies before it
// mints the other side, and it looks the source account up scoped by user
// (20260721090000:65-74). A row whose account belonged to somebody else made
// that lookup find nothing and skipped the guard in silence. The pairing is
// what stops that shape existing; this spec is what stops the RPC-reachable
// half of it coming back.
export default {
  invariant: 'R-12',
  title: 'a create may not name an account belonging to another login as the far side of a transfer',
  design: 'transactions_transfer_account_id_user_fkey (20260808170000:456-463) against create_transaction_atomic 20260808150000:196, which passes the column through unchecked',
  consequence: 'a transfer whose far side is a stranger\'s account, minted through an ordinary RPC call — and the currency guard that would have caught it looks the source up scoped by user, so it finds nothing and stands down',
  parity: 'match',

  setup: secondUser,

  command: {
    verb: 'create_transaction',
    payload: {
      id: NEW_ROW,
      user_id: USER,
      // The caller's own account. Only the far side is wrong.
      account_id: EVERYDAY,
      description: 'To an account that is not mine',
      amount: '-10.00',
      type: 'transfer',
      date: '2024-03-02',
      transfer_account_id: SOMEONE_ELSES_ACCOUNT,
    },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'FOREIGN KEY constraint failed' },
    postgres: { outcome: 'refused', error: 'transactions_transfer_account_id_user_fkey' },
  },

  state: [
    accountExists(SOMEONE_ELSES_ACCOUNT, '1'),
    // Nothing survived the refusal, on the account the row WAS legitimately in.
    balanceOf(EVERYDAY, OPENING_BALANCE),
    balanceIdentityHolds(EVERYDAY),
    rowsInAccount(EVERYDAY, '1'),
    balanceOf(SOMEONE_ELSES_ACCOUNT, '0.00'),
    auditRowsInTotal('0'),
    {
      name: 'nothing_names_the_strangers_account_as_a_far_side',
      sqlite: `SELECT COUNT(*) FROM transactions WHERE transfer_account_id = '${SOMEONE_ELSES_ACCOUNT}'`,
      postgres: `SELECT COUNT(*) FROM public.transactions WHERE transfer_account_id = '${SOMEONE_ELSES_ACCOUNT}'`,
      expect: '0',
    },
  ],
};
