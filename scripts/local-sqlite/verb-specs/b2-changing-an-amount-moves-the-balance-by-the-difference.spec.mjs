import {
  USER, EVERYDAY, RAINY_DAY, CORNER_SHOP,
  balanceOf, balanceIdentityHolds, storedAmount, auditRowsForUpdate,
} from './_shared.mjs';

// B-2 on the edit path, which is where a port is most likely to lose it.
//
//     IF v_new.amount <> v_old.amount THEN
//       UPDATE public.accounts
//          SET balance = balance + (v_new.amount - v_old.amount)
//        WHERE id = v_new.account_id AND user_id = v_new.user_id;
//       IF NOT FOUND THEN RAISE 'account_not_found_or_not_owned'; END IF;
//     END IF;                                          -- 20260808100000:339-348
//
// Two things are load-bearing and both are easy to write wrong.
//
// The move is RELATIVE and it is a DIFFERENCE: `balance + (new - old)`, never
// `balance - old` followed by `balance + new` on the same account (which would
// be correct arithmetic and two round trips through an intermediate state), and
// never a recomputed absolute figure. There is no absolute balance setter on
// this command surface and there must not be one (DESIGN.md §6.5, B-2).
//
// And the arithmetic is on the TRANSACTION's two amounts. No balance is ever
// read into the application to be added to and written back — that is the
// read-modify-write the cloud spent a migration eliminating, and the seam
// through which floats came back last time (DESIGN.md §1.10).
//
// -25.00 becomes -40.00, so the account moves by -15.00, and B-1 has to close
// afterwards or the difference was computed the wrong way round.
export default {
  invariant: 'B-2',
  title: 'changing an amount moves the account by the difference, not to a recomputed figure',
  design: 'update_transaction_atomic 20260808100000:339-348 — balance = balance + (new − old), guarded by IF NOT FOUND',
  consequence: 'getting the sign or the base wrong here breaks B-1 permanently and invisibly: every report still adds up, against a balance that is no longer the sum of its rows',
  parity: 'match',

  command: {
    verb: 'update_transaction',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      patch: { amount: '-40.00' },
    },
  },

  expect: { outcome: 'ok' },
  result: { amount: '-40.00', account_id: EVERYDAY },

  state: [
    storedAmount(CORNER_SHOP, '-40.00'),
    balanceOf(EVERYDAY, '-40.00'),
    // The other account was not involved and did not move.
    balanceOf(RAINY_DAY, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsForUpdate(CORNER_SHOP, '1'),
  ],
};
