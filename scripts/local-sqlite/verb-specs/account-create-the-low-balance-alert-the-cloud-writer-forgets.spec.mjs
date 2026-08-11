import {
  USER, NEW_ACCOUNT,
  accountFlag, balanceIdentityHolds,
} from './_shared.mjs';

// A declared divergence in the LOCAL edition's favour, and it is a real one: the
// column exists in both engines and the cloud's CLIENT leaves it out of a create.
export default {
  invariant: 'B-7',
  title: 'a create that configures a low-balance alert keeps it here and loses it in the cloud',
  design: 'the seam’s rule that a create gives back every field it was given (contract.ts, accounts); accountService.createAccount:226-262 sends fourteen columns and neither of these two',
  consequence: 'the incident this rule was written after is exactly this field — "Account Settings turned the alert OFF when the user saved something else" (accountMapping.ts:13-16). On a device the file is the only store, so a dropped alert is a lost alert',
  parity: 'divergent',
  reason: 'the cloud’s own writer does not send low_balance_alert_enabled or low_balance_threshold on a create, so the columns take their defaults there (false / NULL) while the verb stores what the caller asked for. A difference of CLIENT, not of schema: both engines have the columns',

  command: {
    verb: 'create_account',
    payload: {
      id: NEW_ACCOUNT,
      user_id: USER,
      name: 'Rainy day',
      low_balance_alert_enabled: true,
      low_balance_threshold: '25.00',
    },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    created_at: 'the instant of the write, on two clocks and in two transactions',
    updated_at: 'the same instant, and the same two clocks',
    low_balance_alert_enabled: 'the cloud’s writer does not send it; the verb does',
    low_balance_threshold: 'the same omission, and the same column on both engines',
  },

  state: [
    accountFlag(NEW_ACCOUNT, 'low_balance_alert_enabled', { sqlite: 'yes', postgres: 'no' }),
    balanceIdentityHolds(NEW_ACCOUNT),
  ],
};
