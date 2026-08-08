import { USER } from './_shared.mjs';

export default {
  invariant: 'B-4',
  title: 'snapping an account nobody has is refused before anything is written',
  design: '20260613090000:197-203',
  consequence: 'the link handler passes an id straight from the provider\'s payload; an unmatched one must stop there rather than reaching an UPDATE that silently matches no rows',
  parity: 'match',

  command: {
    verb: 'link_bank_account_snap',
    payload: {
      account_id: 'a0000000-0000-0000-0000-0000000000ee',
      user_id: USER,
      bank_balance: '100.00',
    },
  },
  expect: { outcome: 'refused', error: 'account_not_found_or_not_owned' },
};
