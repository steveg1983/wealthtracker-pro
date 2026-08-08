import {
  USER, EVERYDAY, CORNER_SHOP,
  balanceOf, balanceIdentityHolds, splitLines, auditShape, storedFlag,
} from './_shared.mjs';

// REFUSAL 1 of 20, and the reason the local command struct takes `splits` as raw
// JSON rather than as a `Vec`.
//
// A `Vec<SplitLine>` would be the obvious Rust type and it would be wrong here:
// serde would refuse a string before the verb ran, under a deserialiser's name
// ("invalid type: string"), while the cloud refuses it inside the function under
// its own. Same outcome, different sentence, and `handleSupabaseError` puts that
// sentence in front of the user.
//
// It is also first in the order for a reason worth keeping: it fires before the
// transaction is even looked up, so a caller sending nonsense learns that the
// nonsense is the problem rather than being told their transaction does not
// exist. MEASURED: with a non-existent id AND a non-array `splits`, the cloud
// still says this.
export default {
  invariant: 'S-11',
  title: 'a splits payload that is not an array is refused before anything else is looked at',
  design: 'set_transaction_splits_with_legs 20260806094058:161-163 — the first statement in the function body',
  consequence: 'a caller that sends the wrong shape is told about the wrong problem, or is told nothing and writes an empty split',
  parity: 'match',

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      splits: 'nope',
    },
  },

  expect: { outcome: 'refused', error: 'p_splits must be a jsonb array' },

  state: [
    splitLines(CORNER_SHOP, 'NONE'),
    storedFlag(CORNER_SHOP, 'is_split', 'no'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    auditShape('NONE'),
  ],
};
