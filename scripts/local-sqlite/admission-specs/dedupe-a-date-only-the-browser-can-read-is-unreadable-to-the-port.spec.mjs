// A DECLARED DIVERGENCE, and one where both sides accept.
//
// `Date.parse("2027-2-7")` succeeds in node and is IMPLEMENTATION-DEFINED:
// ECMA-262 lets an engine accept whatever it likes once the standard format
// does not match, and V8's fallback also reads "Feb 7 2027" and "2/7/2027",
// whose meaning depends on the reader's nationality. Porting that would mean
// porting V8.
//
// It depends on the reader's TIMEZONE too, not just their nationality, and
// that is one layer deeper than this file first recorded: the fallback forms
// parse at LOCAL midnight while the standard form parses at UTC midnight
// (ECMA-262's date-only rule), so the day_gap below is 0 in London and 1 in
// Central Europe for the very same file. The harness pins TZ=UTC (see
// admission.mjs) so this comparison of two ENGINES cannot change verdict with
// the operator's location; the production TS really does vary this way, which
// is one more cost of the fallback parser this spec exists to record.
//
// The direction of the consequence is why the port is allowed to be stricter: a
// date it cannot read drops the row out of MATCHING, so the row imports and is
// visible in the register. It fails towards "an extra row the user can see",
// never towards "a payment that vanished".
import { ACCOUNT, held, incoming } from './_shared.mjs';

export default {
  invariant: 'TS-I7',
  title: 'V8\'s fallback date parser is deliberately not ported, and this is what that costs',
  design: 'crates/wealth-core/src/admission/day.rs — "What is deliberately NOT reproduced"',
  consequence: 'the port offers one fewer duplicate for review than the browser would, and '
    + 'the extra row lands in the register where a person can see it',
  parity: 'divergent',
  reason: 'the TypeScript reaches V8\'s implementation-defined fallback parser; the port reads '
    + 'the standard date-only form and treats everything else as unreadable',

  command: {
    verb: 'plan_statement_duplicates',
    payload: {
      account_id: ACCOUNT,
      incoming: [incoming({ date: '2027-2-7', amount: '-20.00', description: 'Cash', fit_id: 'fit-1' })],
      held: [held({ id: 'held', date: '2027-02-07', amount: '-20.00', description: 'Cash' })],
    },
  },

  expect: { outcome: 'ok' },
  divergentResult: {
    typescript: {
      certain: [],
      possible: [{
        incoming_index: 0, fit_id: 'fit-1', held_id: 'held',
        held_description: 'Cash', held_date: '2027-02-07', held_amount: '-20.00',
        held_cleared: false, basis: 'amount-and-date', day_gap: 0, description_similarity: 1,
      }],
    },
    rust: { certain: [], possible: [] },
  },
};
