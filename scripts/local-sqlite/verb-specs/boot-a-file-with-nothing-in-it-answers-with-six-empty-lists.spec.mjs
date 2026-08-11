import { USER, wiped, auditRowsInTotal } from './_shared.mjs';

export default {
  invariant: 'BOOT-1',
  title: 'a brand-new file boots on six empty lists, which is an answer and not a failure',
  design: 'BootSnapshot types every one of its six as an array with no null in it, and DataServiceImpl.loadBoot builds the snapshot empty before it reads anything. A file on the day it is made is exactly this state, and so is every file the moment before its first account exists',
  consequence: 'the difference between six empty lists and a rejected promise is the difference between an app that opens on its "add an account" page and a full-page "Failed to load data" in front of somebody whose file is perfectly fine. It also has to be six EMPTY LISTS rather than five and a null: the app maps each one by name, and a null there is a crash on the first render rather than an empty page',
  parity: 'match',

  setup: wiped,
  command: { verb: 'load_boot', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    accounts: [],
    categories: [],
    transactions: [],
    transaction_splits: [],
    budgets: [],
    goals: [],
  },
  state: [auditRowsInTotal('0')],
};
