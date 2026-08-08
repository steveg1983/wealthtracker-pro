import {
  USER, EVERYDAY, CORNER_SHOP,
  enriched, balanceIdentityHolds, storedTags,
} from './_shared.mjs';

// The other half of the tags rule, and the half that would have become a
// divergence if the local command struct had been typed the obvious way.
//
//     CASE WHEN p ? 'tags' AND jsonb_typeof(p->'tags') = 'array' THEN ... END
//
// `"tags": ""` is a PRESENT key whose value is not an array, so it is ignored
// and the row keeps its tags. MEASURED on the reference cluster: they survive.
//
// A `Vec<String>` in the Rust patch would have made this a deserialiser error —
// a refusal where the cloud shrugs — and nobody would have found out until a
// client that sends `tags: ""` for "no tags entered" met the local edition. It
// is typed as raw JSON instead, and `jsonb_typeof(...) = 'array'` is reproduced
// as a match on the parsed value.
//
// Note this is NOT the same as the allow-list divergence: `tags` IS in the
// fifteen, so an unusable value for a known key is ignored on both engines. A
// key that is not in the fifteen at all is refused locally and discarded in the
// cloud — see
// `update-transaction-a-key-outside-the-allow-list-is-discarded-by-the-cloud.spec.mjs`.
export default {
  invariant: 'R-4',
  title: 'a tags key whose value is not an array is ignored, not refused and not applied',
  design: "update_transaction_atomic 20260808100000:321-323 — the second condition, jsonb_typeof(p->'tags') = 'array'",
  consequence: 'typing this field as a list of strings would refuse a payload the cloud accepts, and the two editions would disagree about whether an edit succeeded',
  parity: 'match',

  setup: enriched,

  command: {
    verb: 'update_transaction',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      patch: { tags: '', description: 'Tags mentioned, unusably' },
    },
  },

  expect: { outcome: 'ok' },
  result: {
    tags: ['one', 'two'],
    description: 'Tags mentioned, unusably',
  },

  state: [
    storedTags(CORNER_SHOP, 'one,two'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
