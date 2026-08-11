import { USER, preferenceDocuments } from './_shared.mjs';

const FROM_A_NEWER_CLIENT = {
  version: 97,
  values: { somethingNobodyHasWrittenYet: 'true' },
  aSectionTheDocumentTypeDoesNotHave: { nested: [1, 2, { deep: null }] },
};

export default {
  invariant: 'PREF-4',
  title: 'a document from a client neither engine knows is stored whole and comes back whole',
  design: 'preferences/document.ts: "a key this build has never heard of is preserved untouched. An older client cannot drop a newer client\'s preference, because it never parses it". Neither store parses one either — the crate treats the document as opaque and says so at length in verbs/preferences.rs',
  consequence: 'this is the property that makes it safe to have two app versions in use at once. A store that normalised the document — dropped an unknown key, re-ordered it, coerced a nested value — would silently delete the newer client\'s settings every time the older one saved anything',
  parity: 'match',

  command: {
    verb: 'write_preferences',
    payload: { user_id: USER, preferences: FROM_A_NEWER_CLIENT },
  },
  expect: { outcome: 'ok' },
  result: { preferences: FROM_A_NEWER_CLIENT },
  state: [preferenceDocuments('1')],
};
