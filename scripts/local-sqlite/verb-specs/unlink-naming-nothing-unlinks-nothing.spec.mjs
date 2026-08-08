import { USER, EVERYDAY, RAINY_DAY, OTHER_LEG, THIS_LEG, transferPair,
  balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  linkedRows, auditRowsInTotal } from './_shared.mjs';

// The RPC's first two lines: `IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL
// THEN RETURN 0`. An empty call is a no-op and not an error, which matters
// because the client builds the list from a selection and an empty selection is
// an ordinary thing to have.
//
// This is also the only spec in the suite where an ACCEPTED call projects no
// row: there is no first named id to project, so both engines report the absence
// and the harness compares them on that.
export default {
  invariant: 'T-12',
  title: 'unlinking an empty list is a no-op, not an error',
  design: 'clear_transfer_links 20260805145035:116-118',
  consequence: 'a client with an empty selection gets an exception instead of a zero',
  parity: 'match',

  setup: transferPair,
  command: { verb: 'clear_transfer_links', payload: { ids: [], user_id: USER } },
  expect: { outcome: 'ok' },

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
