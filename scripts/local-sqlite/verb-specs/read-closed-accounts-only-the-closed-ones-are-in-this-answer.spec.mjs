import {
  USER, EVERYDAY, RAINY_DAY, OPENED_SECOND,
  setups, closedRainyDay, pinnedReadTimes, listedAccount, balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-2',
  title: 'the closed list holds the closed account and nothing else',
  design: 'accountService.getClosedAccounts — the same query as getAccounts with .eq(\'is_active\', false), for the Accounts page\'s Closed Accounts section. Two questions, and the local edition gives them two verb names rather than one verb and a boolean',
  consequence: 'this is the only way back: closing is soft and reversible, and an account that fell out of both lists would be money nobody could reach from the page it lives on',
  parity: 'match',

  setup: setups(closedRainyDay, pinnedReadTimes),
  command: { verb: 'list_closed_accounts', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    closed_accounts: [
      listedAccount({
        id: RAINY_DAY, name: 'Rainy day', type: 'savings', is_active: false,
        created_at: OPENED_SECOND, updated_at: OPENED_SECOND,
      }),
    ],
  },
  state: [
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
