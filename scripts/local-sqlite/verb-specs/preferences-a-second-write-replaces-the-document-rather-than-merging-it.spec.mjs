import { USER, preferenceDocuments, preferencesAlready, settingOf } from './_shared.mjs';

export default {
  invariant: 'PREF-3',
  title: 'writing again replaces the whole document, and one login still has one of them',
  design: 'the cloud writes `.upsert({ user_id, prefs }, { onConflict: \'user_id\' })` and the verb writes `INSERT … ON CONFLICT(user_id) DO UPDATE` — the same statement, not the same outcome by two routes. preferencesService: the document is read as a SET and written whole',
  consequence: 'a key the caller left out is a key the person REMOVED, possibly on another machine. A merge would resurrect it on every write, so a preference could never be turned off from a second device — and a store that inserted instead of upserting would leave two documents and let whichever the reader found first win',
  parity: 'match',

  setup: preferencesAlready({ version: 1, values: { keep: 'no', drop: 'yes' } }),

  command: {
    verb: 'write_preferences',
    payload: { user_id: USER, preferences: { version: 1, values: { keep: 'yes' } } },
  },
  expect: { outcome: 'ok' },
  result: { preferences: { version: 1, values: { keep: 'yes' } } },
  state: [
    preferenceDocuments('1'),
    settingOf(USER, 'keep', 'yes'),
    settingOf(USER, 'drop', '(none)'),
  ],
};
