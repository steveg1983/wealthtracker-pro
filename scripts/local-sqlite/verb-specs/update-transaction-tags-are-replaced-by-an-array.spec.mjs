import {
  USER, EVERYDAY, CORNER_SHOP,
  enriched, balanceIdentityHolds, storedTags,
} from './_shared.mjs';

// The fifteenth behaviour, which is its own class of one.
//
//     tags = CASE WHEN p ? 'tags' AND jsonb_typeof(p->'tags') = 'array'
//                 THEN ARRAY(SELECT jsonb_array_elements_text(p->'tags'))
//                 ELSE tags END                       -- 20260808100000:321-323
//
// TWO conditions, and the second is what makes this different from every other
// field: a present key is not enough, it has to be an array. This spec covers
// the half that replaces; the half that does NOT is
// `update-transaction-a-tags-key-that-is-not-an-array-is-ignored.spec.mjs`, and
// they are separate files because one spec means one payload.
//
// The replacement is wholesale, not a merge: the cloud assigns a new `text[]`,
// so the local port deletes the child rows and re-inserts. An empty ARRAY is
// therefore a real instruction — remove every tag — and is not the same as an
// absent key.
export default {
  invariant: 'R-4',
  title: 'a JSON array of tags replaces the whole set, it does not merge into it',
  design: "update_transaction_atomic 20260808100000:321-323 — `p ? 'tags' AND jsonb_typeof(p->'tags') = 'array'`",
  consequence: "a port that merged instead of replacing would make removing a tag impossible through the edit form, and the tag would come back on every subsequent save",
  parity: 'match',

  setup: enriched,

  command: {
    verb: 'update_transaction',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      // Sent in sorted order on purpose, as the create verb's tag spec is: a
      // child table has no order column, so asserting a sequence here would
      // measure the harness's own sort rather than the verb. What this DOES
      // measure is membership — 'two' was there and is not any more, and 'one'
      // is still there, so the array replaced the set rather than merging into
      // it or clearing it.
      patch: { tags: ['one', 'three'] },
    },
  },

  expect: { outcome: 'ok' },
  result: { tags: ['one', 'three'] },

  state: [
    // Replaced, not merged: 'two' is gone.
    storedTags(CORNER_SHOP, 'one,three'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
