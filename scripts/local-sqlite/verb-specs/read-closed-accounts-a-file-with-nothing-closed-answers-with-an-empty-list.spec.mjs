import { USER, EVERYDAY, pinnedReadTimes, balanceIdentityHolds, auditRowsInTotal } from './_shared.mjs';

export default {
  invariant: 'READ-3',
  title: 'a file where nothing has been closed answers with an empty list, not with the open accounts',
  design: 'the two account reads are complementary halves of one table — .eq(\'is_active\', true) and .eq(\'is_active\', false) — so the fixture\'s two OPEN accounts are exactly what this answer must not contain',
  consequence: 'the Closed Accounts section is drawn from this answer, and a read that fell back to "all accounts" when there were no closed ones would put every live account under a heading saying it was closed',
  parity: 'match',

  setup: pinnedReadTimes,
  command: { verb: 'list_closed_accounts', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: { closed_accounts: [] },
  state: [balanceIdentityHolds(EVERYDAY), auditRowsInTotal('0')],
};
