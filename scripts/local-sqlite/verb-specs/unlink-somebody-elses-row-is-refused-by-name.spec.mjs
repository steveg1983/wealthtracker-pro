import { STRANGER, EVERYDAY, RAINY_DAY, OTHER_LEG, THIS_LEG, transferPair, secondUser,
  setups, balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  linkedRows, auditRowsInTotal } from './_shared.mjs';

// X-6. The ownership guard is inside the existence check, so a row that is not
// yours is reported as a row that is not there — the same refusal, deliberately.
export default {
  invariant: 'X-6',
  title: 'unlinking as a user who owns nothing named is refused by name',
  design: 'clear_transfer_links 20260805145035:121-129',
  consequence: 'one login can break another login\'s transfer pairs',
  parity: 'match',

  setup: setups(transferPair, secondUser),
  command: { verb: 'clear_transfer_links', payload: { ids: [OTHER_LEG], user_id: STRANGER } },
  expect: { outcome: 'refused', error: 'transaction_not_found' },

  state: [
    transferShape(OTHER_LEG, `transfer:-:0002:${THIS_LEG.slice(-4)}:-`),
    transferLinksAreMutual(),
    linkedRows('2'),
    balanceOf(EVERYDAY, '-40.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
