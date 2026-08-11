import {
  USER, NEW_DISMISSAL,
  dismissalShape, dismissalsOwnedBy, subjectRowsInTotal,
} from './_shared.mjs';

// A declared divergence in the LOCAL edition's favour, and a structural one: the
// cloud's column comment CLAIMS the property, this schema makes it a constraint.
export default {
  invariant: 'R-12',
  title: 'a refusal about a row that does not exist is refused here and stored in the cloud',
  design: '20260806180000:91-95 — subject_ids is uuid[] and its comment says it "resolves entirely against public.transactions", enforced by nothing. schema.sql makes suggestion_dismissal_subjects.transaction_id a REFERENCES transactions(id) ON DELETE CASCADE and argues in place that the child table is the better shape: the prune trigger becomes an indexed join, and "every id resolves in exactly one table" becomes a foreign key instead of a promise',
  consequence: 'nothing a user can reach differs — a sweep only ever offers rows it has just read, and the prune trigger exists so they cannot stop existing underneath a dismissal. What the constraint buys is that a local file cannot accumulate the junk the cloud’s trigger was written to clean up, and cannot silently carry it into every backup taken afterwards',
  parity: 'divergent',
  reason: 'the cloud has no foreign key on subject_ids and cannot have one — Postgres does not constrain array elements — so it stores an id naming nothing. The file does, so the whole write is refused and nothing lands. A difference of SCHEMA, not of client: both engines were handed the same payload',

  command: {
    verb: 'dismiss_suggestion',
    payload: {
      id: NEW_DISMISSAL,
      user_id: USER,
      kind: 'duplicate',
      subject_key: 'about a row that is not there',
      subject_ids: ['70000000-0000-0000-0000-0000000000ff'],
    },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'FOREIGN KEY constraint failed' },
    postgres: { outcome: 'ok' },
  },

  state: [
    // ALL OR NOTHING on the refusing engine: the parent row is gone too, because
    // the whole verb is one transaction and the subject insert is inside it. A
    // port that had committed the dismissal and then failed the subject would
    // leave a refusal with no rows in it — indistinguishable, on the read side,
    // from a legitimate payee dismissal.
    dismissalShape('duplicate', 'about a row that is not there', {
      sqlite: 'GONE',
      postgres: 'duplicate:about a row that is not there:1',
    }),
    dismissalsOwnedBy(USER, { sqlite: '0', postgres: '1' }),
    subjectRowsInTotal({ sqlite: '0', postgres: '1' }),
  ],
};
