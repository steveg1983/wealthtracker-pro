import { USER, EVERYDAY, CORNER_SHOP, storedFlag, auditShape,
  balanceIdentityHolds } from './_shared.mjs';

// The only verb in this family whose boolean is GUARDED rather than merely
// required by the signature: `IF p_archived IS NULL THEN RAISE`. Both engines
// refuse with the RPC's own sentence, so a caller reading the message gets the
// same words either way.
//
// Note what it is NOT: a default. Defaulting an absent direction to `true` would
// make "archive" the answer to a question the caller failed to ask, on a verb
// whose whole subject is what the register shows.
export default {
  invariant: 'A-4',
  title: 'an archive that does not say which way is refused, in the cloud\'s own words',
  design: 'set_transactions_archived 20260805145035:191-193',
  consequence: 'a malformed call hides rows nobody asked to hide',
  parity: 'match',

  command: {
    verb: 'set_transactions_archived',
    payload: { ids: [CORNER_SHOP], user_id: USER },
  },
  expect: { outcome: 'refused', error: 'p_archived must be true or false' },

  state: [
    storedFlag(CORNER_SHOP, 'archived', 'no'),
    auditShape('NONE'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
