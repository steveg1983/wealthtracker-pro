import { USER, EVERYDAY, balanceIdentityHolds, auditRowsInTotal } from './_shared.mjs';

export default {
  invariant: 'READ-3',
  title: 'a login that has never refused a suggestion gets an empty list',
  design: 'the base fixture holds no dismissals at all, which is the state of every file until somebody says "stop offering me this". suggestionDismissalService.list builds its result from `data ?? []`',
  consequence: 'the sweeps subtract this list from what they offer. An answer that failed instead of coming back empty would take the transfer, duplicate and stranded sweeps down with it on a brand-new file',
  parity: 'match',

  command: { verb: 'list_suggestion_dismissals', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: { suggestion_dismissals: [] },
  state: [balanceIdentityHolds(EVERYDAY), auditRowsInTotal('0')],
};
