import {
  USER, EVERYDAY,
  balanceOf, balanceDrift, writeInstants,
} from './_shared.mjs';

// THE money divergence of the family, and the one worth reading twice.
export default {
  invariant: 'B-1',
  title: 'correcting an opening balance moves the balance by the same difference — here, and not in the cloud',
  design: 'the ledger identity balance = initial_balance + Σ(amounts); link_bank_account_snap arrives at the same rebase from the other end',
  consequence: 'the fixture account holds one −25.00 row. Moving its opening balance from 0.00 to 100.00 must leave it at 75.00; leaving the balance alone leaves the account claiming −25.00 while its own rows add up to 75.00, and every figure derived from it is then wrong by exactly the correction',
  parity: 'divergent',
  reason: 'the cloud’s account update is a plain PostgREST write of whatever mapAccountToDb produced: it sets initial_balance and does not touch balance, so B-1 is broken by the size of the correction and nothing there notices. The verb moves both sides in one statement, in SQL, relative',

  command: {
    verb: 'update_account',
    payload: { id: EVERYDAY, user_id: USER, patch: { initial_balance: '100.00' } },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    ...writeInstants,
    balance: 'the verb carries it with the opening balance; the cloud leaves it where it was',
  },

  result: { initial_balance: '100.00' },

  state: [
    balanceOf(EVERYDAY, { sqlite: '75.00', postgres: '-25.00' }),
    balanceDrift(EVERYDAY, { sqlite: '0.00', postgres: '-100.00' }),
  ],
};
