import {
  USER, NEW_DISMISSAL,
  dismissalShape, subjectsInRoleOrder, dismissalsOwnedBy, subjectRowsInTotal,
} from './_shared.mjs';

// THE SPEC THAT PINS THE CHECK 20260817220000 WIDENED — on both engines.
//
// `recurring-confirmed` is the first POSITIVE verdict this table holds: the
// user vouching that a detected recurring pattern is a real commitment, which
// is the statement that lets it feed the forward calendar and the forecast
// (Design handover 17 Aug §5 — an unconfirmed detection is the app's opinion
// and may never silently feed anything). A CHECK that refused it would be the
// whole Confirm control failing to save on a local file. Narrow either
// engine's list back and this spec goes red on that engine alone.
export default {
  invariant: 'B-7',
  title: 'a recurring verdict names its pattern and no rows at all',
  design: '20260817220000 added recurring-confirmed and recurring-not by DROP + ADD of suggestion_dismissals_kind_known. The key is account:<id>|recurring:<direction>:<percent-encoded payee key> — the account segment is a role-prefixed row id the restore path remaps IN PLACE, so a verdict follows its account into a new login; the pattern segment’s value always contains a further ":", so no remapper can mistake the payee text for an id',
  consequence: 'The "What I’m committed to" report drives both kinds through the seam’s one dismissSuggestion door. subject_ids is EMPTY because a pattern outlives its rows: delete a year of statements and re-import, and the same payments arrive on new ids — a verdict that expired with the rows would put the question straight back in front of a user who had already answered it',
  parity: 'match',

  command: {
    verb: 'dismiss_suggestion',
    payload: {
      id: NEW_DISMISSAL,
      user_id: USER,
      kind: 'recurring-confirmed',
      subject_key: 'account:11111111-1111-4111-8111-111111111111|recurring:out:FLIXWATCH%20COM',
      // EMPTY, and the emptiness is the feature — see consequence above.
      subject_ids: [],
    },
  },

  expect: { outcome: 'ok' },

  result: {
    kind: 'recurring-confirmed',
    subject_key: 'account:11111111-1111-4111-8111-111111111111|recurring:out:FLIXWATCH%20COM',
    subject_ids: [],
  },

  rowDivergence: {
    dismissed_at: 'the instant of the write, on two clocks and in two transactions',
  },

  state: [
    dismissalShape('recurring-confirmed', 'account:11111111-1111-4111-8111-111111111111|recurring:out:FLIXWATCH%20COM',
      'recurring-confirmed:account:11111111-1111-4111-8111-111111111111|recurring:out:FLIXWATCH%20COM:0'),
    subjectsInRoleOrder('recurring-confirmed', 'account:11111111-1111-4111-8111-111111111111|recurring:out:FLIXWATCH%20COM', 'NONE'),
    dismissalsOwnedBy(USER, '1'),
    // Nothing was written to the child table, on the engine that has one.
    subjectRowsInTotal('0'),
  ],
};
