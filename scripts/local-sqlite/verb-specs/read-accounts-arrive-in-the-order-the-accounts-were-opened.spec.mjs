import {
  USER, EVERYDAY, RAINY_DAY, OPENED_SECOND,
  pinnedReadTimes, listedAccount, balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-1',
  title: 'the accounts come back oldest first, and every column comes back with them',
  design: 'accountService.getAccounts: .select(\'*\').eq(\'user_id\', …).eq(\'is_active\', true).order(\'created_at\', { ascending: true }). The order is not decoration — the Accounts page draws its sections in the order this answer arrives',
  consequence: 'a read that returned the same accounts in a different order would reshuffle the page on every boot, and one that returned a narrower row would blank whatever it left out: mapAccountFromDb reads the whole row, and the last time two mappers disagreed about it the dashboard silently lost its low-balance alert',
  parity: 'match',

  setup: pinnedReadTimes,
  command: { verb: 'list_accounts', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    accounts: [
      listedAccount({ id: EVERYDAY, name: 'Everyday', type: 'checking', balance: '-25.00' }),
      listedAccount({
        id: RAINY_DAY, name: 'Rainy day', type: 'savings', balance: '0.00',
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
