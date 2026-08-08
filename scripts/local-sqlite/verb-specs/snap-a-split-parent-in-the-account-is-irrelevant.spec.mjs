import { USER, EVERYDAY, splitWithTransferLeg, storedBalances } from './_shared.mjs';

export default {
  invariant: 'S-5',
  title: 'a split parent in the account does not need a guard, and is proved not to',
  design: 'The guard question is asked per verb and answered by running it. Every trg_protect_split_* trigger is BEFORE UPDATE OF a column on transactions; this is an UPDATE of accounts, so none of them is even consulted. MEASURED on both engines',
  consequence: 'holding _rpc_guard(\'split\') here "just in case" would stand S-5 down for a write that never touches a split row — a protection weakened by a verb that had no use for it',
  parity: 'match',

  setup: splitWithTransferLeg,
  command: {
    verb: 'link_bank_account_snap',
    payload: { account_id: EVERYDAY, user_id: USER, bank_balance: '10.00' },
  },
  expect: { outcome: 'ok' },
  result: { balance: '10.00', initial_balance: '35.00' },
  state: [
    storedBalances(EVERYDAY, '10.00/35.00'),
    {
      name: 'the_guard_was_never_held',
      sqlite: 'SELECT COUNT(*) FROM _rpc_guard',
      postgres: "SELECT CASE WHEN current_setting('app.split_rpc', true) IN ('', '0') THEN 0 ELSE 1 END",
      expect: '0',
    },
    {
      name: 'the_split_is_untouched',
      sqlite: `SELECT COUNT(*) FROM transaction_splits WHERE user_id = '${USER}'`,
      postgres: `SELECT COUNT(*) FROM public.transaction_splits WHERE user_id = '${USER}'`,
      expect: '2',
    },
  ],
};
