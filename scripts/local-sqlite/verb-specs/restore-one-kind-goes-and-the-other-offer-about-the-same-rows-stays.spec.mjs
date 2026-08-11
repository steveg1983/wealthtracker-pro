import {
  USER, ONE_KEY, sameKeyTwoKinds,
  dismissalShape, dismissalsOwnedBy, subjectRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'X-6',
  title: 'undoing one kind leaves the other offer about the same rows refused',
  design: '20260806180000:41-46 — "the unique constraint carries kind, so two kinds can never collide even when they name the same rows — and they legitimately can: the same two rows are a transfer pair to one scan and a duplicate to another"',
  consequence: 'the migration states the stakes itself: "refusing one offer must not silently suppress the other, whose consequence is completely different (linking two rows changes their filing; deleting one destroys it)". Run backwards, a restore that matched on subject_key alone would un-hide a DELETE suggestion the user had refused, on rows they had already told the app to leave alone',
  parity: 'match',

  setup: sameKeyTwoKinds,

  command: {
    verb: 'restore_suggestion',
    payload: { user_id: USER, kind: 'transfer-pair', subject_key: ONE_KEY },
  },

  expect: { outcome: 'ok' },

  result: { deleted: 1 },

  state: [
    dismissalShape('transfer-pair', ONE_KEY, 'GONE'),
    dismissalShape('duplicate', ONE_KEY, `duplicate:${ONE_KEY}:1`),
    dismissalsOwnedBy(USER, '1'),
    // The survivor keeps its own subject. Both dismissals named the SAME
    // transaction, so a cascade that had followed the transaction rather than the
    // dismissal would have taken this one too.
    subjectRowsInTotal('1'),
  ],
};
