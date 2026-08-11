import {
  USER, EVERYDAY, RAINY_DAY, OPENED_SECOND,
  setups, secondUser, pinnedReadTimes, listedAccount, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-5',
  title: 'a second login\'s account is in the file and not in the answer',
  design: 'every cloud read is .eq(\'user_id\', userId) with an id DataService resolved on the same tick. The cloud has RLS behind that filter; a local file has nothing behind it at all, and a restore can genuinely leave a second login\'s rows in one',
  consequence: 'this is the only thing standing between two logins in one file and one of them seeing the other\'s money. It is why the read\'s owner is a required String and not an Option',
  parity: 'match',

  setup: setups(secondUser, pinnedReadTimes),
  command: { verb: 'list_accounts', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    accounts: [
      listedAccount({ id: EVERYDAY, name: 'Everyday', type: 'checking', balance: '-25.00' }),
      listedAccount({
        id: RAINY_DAY, name: 'Rainy day', type: 'savings',
        created_at: OPENED_SECOND, updated_at: OPENED_SECOND,
      }),
    ],
  },
  state: [auditRowsInTotal('0')],
};
