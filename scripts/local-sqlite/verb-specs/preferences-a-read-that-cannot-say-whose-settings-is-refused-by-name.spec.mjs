import { preferenceDocuments } from './_shared.mjs';

export default {
  invariant: 'X-6',
  title: 'a read with no owner is refused by name here, and answers "no settings" in the cloud',
  design: 'collect_backup\'s refusal, applied to the other thing a file holds: "a backup taken against an unresolved identity would hand a signed-in person a file made of whatever demo or imported data their browser happens to hold". The cloud transport is never CALLED without one — `PreferencesService.write` returns early when `userId === null` — so its SQL has no such refusal and a null id simply matches no row',
  consequence: 'on a device the owner is resolved ONCE, when the file is opened (D-5), so a call without one is a bug in the caller rather than a session that has not settled. Answering "you have no settings" would send that bug on to the LIFT, which would then write this machine\'s document into the file under nobody',
  parity: 'divergent',
  reason: 'the cloud has nothing to refuse WITH: the transport is a table read, and a `WHERE user_id IS NULL` finds nothing and says so calmly. The refusal is the local edition\'s, and it exists because the local edition is the one where an absent owner cannot be a transient state',

  command: {
    verb: 'read_preferences',
    payload: {},
  },
  expect: {
    sqlite: { outcome: 'refused', error: 'owner_unknown' },
    postgres: { outcome: 'ok' },
  },
  state: [preferenceDocuments('0')],
};
