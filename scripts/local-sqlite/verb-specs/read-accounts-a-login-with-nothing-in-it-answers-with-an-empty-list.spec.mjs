import { USER, wiped, auditRowsInTotal } from './_shared.mjs';

export default {
  invariant: 'READ-3',
  title: 'a login with no accounts gets an empty list, which is an answer and not a failure',
  design: 'accountService.getAccounts returns `(data || []).map(…)`; the seam types it Promise<Account[]> with no null in it. A brand-new file is exactly this state, and so is every file the moment before its first account exists',
  consequence: 'the difference between [] and a rejected promise is the difference between an empty Accounts page with an "add one" button and a full-page "Failed to load data" in front of somebody whose file is perfectly fine',
  parity: 'match',

  setup: wiped,
  command: { verb: 'list_accounts', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: { accounts: [] },
  state: [auditRowsInTotal('0')],
};
