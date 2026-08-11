import { USER, EVERYDAY, balanceOf, balanceDrift } from './_shared.mjs';

// The refusal that is the whole point of having a verb rather than a table.
export default {
  invariant: 'B-2',
  title: 'an update that states a balance is refused by name, and the cloud performs it',
  design: 'DESIGN.md §6.5 and verbs/mod.rs — "there is no way to set an absolute figure because there is no function that takes one"; mapAccountToDb will send `balance` because AccountUpdate is a Partial<Account>',
  consequence: 'the cloud’s account update IS an absolute balance setter, unaudited, with no transaction to justify the figure. That is the same defect accountService.ts:403-412 deleted two methods for, still reachable through this door',
  parity: 'divergent',
  reason: 'the cloud has no rule to break: `balance` is a column and its update writes it. The verb refuses by NAME rather than as an unknown field, so the caller is told the rule and what to do instead — a caller told "unknown field" would reasonably conclude it had made a typo',

  command: {
    verb: 'update_account',
    payload: { id: EVERYDAY, user_id: USER, patch: { balance: '999.00' } },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'account_balance_is_derived' },
    postgres: { outcome: 'ok' },
  },

  state: [
    balanceOf(EVERYDAY, { sqlite: '-25.00', postgres: '999.00' }),
    balanceDrift(EVERYDAY, { sqlite: '0.00', postgres: '1024.00' }),
  ],
};
