import { USER, preferenceDocuments } from './_shared.mjs';

export default {
  invariant: 'PREF-5',
  title: 'a document that is not a JSON object is refused, by the same constraint name on both engines',
  design: 'the cloud\'s `user_preferences_prefs_is_object` CHECK (`jsonb_typeof(prefs) = \'object\'`, 20260809160000:176) and schema.sql\'s port of it. The local CHECK was ANONYMOUS until schema amendment (9); naming it is what lets one spec assert one refusal instead of matching a fragment of each engine\'s SQL',
  consequence: 'every reader indexes into this document by key. An array here is a document nothing can read, stored in a column nothing would complain about — and the person\'s real settings would be gone, replaced by something that reads as "no settings at all"',
  parity: 'match',

  command: {
    verb: 'write_preferences',
    payload: { user_id: USER, preferences: [1, 2, 3] },
  },
  expect: { outcome: 'refused', error: 'user_preferences_prefs_is_object' },
  state: [preferenceDocuments('0')],
};
