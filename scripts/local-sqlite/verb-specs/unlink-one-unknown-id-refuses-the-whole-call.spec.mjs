import { USER, EVERYDAY, RAINY_DAY, OTHER_LEG, THIS_LEG, transferPair,
  balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  linkedRows, auditRowsInTotal } from './_shared.mjs';

// ALL OR NOTHING. The list names one row that exists and one that does not, and
// the row that exists is NOT unlinked. The migration says why (`:84-86`): *"a
// caller naming a row that is not there has a stale picture and should be told,
// not quietly given a smaller number."*
//
// The pre-RPC client had to inspect a returned count to notice, which is a thing
// no client did.
export default {
  invariant: 'T-12',
  title: 'one id nobody has refuses the whole call, including the rows that were fine',
  design: 'clear_transfer_links 20260805145035:120-129 — count(DISTINCT) vs count(*), before the loop',
  consequence: 'a caller with a stale list silently unlinks a subset and believes it unlinked everything',
  parity: 'match',

  setup: transferPair,
  command: {
    verb: 'clear_transfer_links',
    payload: { ids: [OTHER_LEG, '70000000-0000-0000-0000-0000000000ff'], user_id: USER },
  },
  expect: { outcome: 'refused', error: 'transaction_not_found' },

  state: [
    transferShape(OTHER_LEG, `transfer:-:0002:${THIS_LEG.slice(-4)}:-`),
    transferShape(THIS_LEG, `transfer:-:0001:${OTHER_LEG.slice(-4)}:-`),
    transferLinksAreMutual(),
    linkedRows('2'),
    balanceOf(EVERYDAY, '-40.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
