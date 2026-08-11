import {
  STRANGER, USER,
  preferenceDocuments, secondUser, settingOf, setups, strangerPreferences,
} from './_shared.mjs';

export default {
  invariant: 'X-6',
  title: 'a write for one login leaves the other login\'s document exactly where it was',
  design: 'every statement in the pair is scoped `WHERE user_id = ?1`, and the cloud\'s twin is scoped by RLS as well as by the client\'s `.eq()`. localDataPort.ts states why the local edition cannot lean on the second of those: "a local file can hold more than one login\'s rows (a restored backup from an account that had two) and there is no RLS to narrow an answer afterwards"',
  consequence: 'a household file, or a file restored from a login that had two people in it, would otherwise hand one person the other\'s pinned accounts and archive cutoffs — and a write scoped only by the unique index would overwrite them',
  parity: 'match',

  setup: setups(secondUser, strangerPreferences({ version: 1, values: { who: 'theirs' } })),

  command: {
    verb: 'write_preferences',
    payload: { user_id: USER, preferences: { version: 1, values: { who: 'mine' } } },
  },
  expect: { outcome: 'ok' },
  result: { preferences: { version: 1, values: { who: 'mine' } } },
  state: [
    preferenceDocuments('2'),
    settingOf(USER, 'who', 'mine'),
    settingOf(STRANGER, 'who', 'theirs'),
  ],
};
