import { USER, preferenceDocuments } from './_shared.mjs';

export default {
  invariant: 'PREF-2',
  title: 'a store with no document for this login answers null, which is not the same as an empty one',
  design: 'supabasePreferencesTransport.read: `return data === null ? null : parsePreferencesDocument(data.prefs)` — maybeSingle() answers null for no row, and the local verb answers `preferences: null` for the same case',
  consequence: 'PreferencesService.attach branches on exactly this: a null document is what triggers THE LIFT, which writes this machine\'s existing settings up as the store\'s first content. A store answering an empty document instead would tell a person\'s first launch that they had deliberately turned everything off, and their years of choices would be gone',
  parity: 'match',

  command: {
    verb: 'read_preferences',
    payload: { user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { preferences: null },
  state: [preferenceDocuments('0')],
};
