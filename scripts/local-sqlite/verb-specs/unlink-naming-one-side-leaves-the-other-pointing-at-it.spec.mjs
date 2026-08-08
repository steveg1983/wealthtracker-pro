import { USER, EVERYDAY, RAINY_DAY, OTHER_LEG, THIS_LEG, transferPair,
  balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  linkedRows, auditShape } from './_shared.mjs';

// THE GAP, RECORDED RATHER THAN FIXED — and the one spec in this suite that
// asserts a broken invariant on purpose.
//
// T-7 says links are mutual. `clear_transfer_links` names only the rows it was
// given and does not chase reciprocals, so unlinking one side of a pair leaves
// the other side pointing at a row that no longer points back: a one-sided
// transfer, which is the exact thing the whole feature exists to prevent.
// MEASURED on the reference cluster (probe-transfers3.sh, `ctl-one-side-only`)
// and reproduced here.
//
// The migration's reason (`:94-97`): *"the caller names every row it means to
// unlink … and silently editing rows the caller did not name would make the
// returned count a fiction and the client's local state wrong."* The repair verb
// keeps its side of that bargain by naming BOTH rows of the pair it breaks.
//
// A local port that chased the reciprocal would be "more correct" and would
// disagree with the cloud about how many rows a call touched. So it does not,
// and the local edition answers T-7 where a rule the cloud enforces nowhere can
// be answered without diverging: `verify_integrity()`'s
// `transfer_link_not_mutual` check, after the fact, by name.
//
// `transferLinksAreMutual('BROKEN')` is that statement, in a form that fails if
// EITHER engine ever changes its mind.
export default {
  invariant: 'T-7',
  title: 'unlinking one side of a pair leaves the other pointing at it — on both engines',
  design: 'clear_transfer_links 20260805145035:94-97 — only the named rows, no reciprocals',
  consequence: 'either the count the client is given becomes a fiction, or one-sided links accumulate where nothing is looking for them',
  parity: 'match',

  setup: transferPair,
  command: { verb: 'clear_transfer_links', payload: { ids: [OTHER_LEG], user_id: USER } },
  expect: { outcome: 'ok' },
  result: { id: OTHER_LEG, linked_transfer_id: null, type: 'transfer' },

  state: [
    // The named row loses its link and KEEPS its target: it is still a transfer
    // that has lost its partner, which is what makes it eligible for re-linking
    // rather than rubbish.
    transferShape(OTHER_LEG, 'transfer:-:0002:-:-'),
    transferShape(THIS_LEG, `transfer:-:0001:${OTHER_LEG.slice(-4)}:-`),
    transferLinksAreMutual('BROKEN'),
    linkedRows('1'),
    balanceOf(EVERYDAY, '-40.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditShape('transaction/update'),
  ],
};
