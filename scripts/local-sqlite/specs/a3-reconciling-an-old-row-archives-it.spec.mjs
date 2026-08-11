// The row is MARKED in the setup and COMMITTED in the action, and the split
// between those two statements is the whole spec.
//
// It used to tick the row and expect the archive, because one flag did both
// jobs. 20260810200000_marking_is_not_reconciling.sql separated them and moved
// the sweep onto is_reconciled; this mirror went on firing on is_cleared, and
// from that day the spec FAILED — Postgres archived nothing, SQLite archived the
// row, and the declared `match` was observed `divergent`. That failure is what
// the C/R port was measured against, so the fix is in schema.sql and this file
// only stops asking yesterday's question.
//
// The setup half is not incidental either: it MARKS a row dated before the
// cutoff, and the sweep must not fire on it. A tick is reversible and a row you
// cannot see is a row you cannot untick, so a sweep hanging off the mark took
// rows out of the very list the ticking happens on. This harness verifies only
// after the action, so the "a mark alone archives nothing" half is asserted
// where it can be asserted between two statements — the verb harness's
// `cleared-marking-an-old-row-does-not-archive-it`.
export default {
  invariant: 'A-3',
  title: 'reconciling a row that is older than its account cutoff archives it',
  design: 'DESIGN.md §1.6 A-3 ("T"); cloud sweep_reconciled_into_archive as RESTATED by 20260810200000:336-361 (was 20260721130000:123-148, keyed on is_cleared). §2.3 records the shape change: the cloud assigns NEW.archived in a BEFORE trigger, which SQLite cannot do, so the port issues a second UPDATE. The end state is the same; anything watching for a single-statement change sees two',
  consequence: 'old reconciled items linger in the live register forever, and the register the user scrolls stops matching the period they think they are looking at',
  parity: 'match',

  // THE ORDER OF THE TWO SETUP STATEMENTS IS THE WHOLE DISCRIMINATOR, and it was
  // measured rather than reasoned: written the other way round (cutoff first,
  // then the mark) this spec PASSED with the sweep moved back onto `is_cleared`,
  // because the mark archived the row during the setup and the verify — which
  // runs only after the action — cannot see which statement did it.
  //
  // Marking BEFORE the account has a cutoff separates them: a sweep on the mark
  // has nothing to act on when the tick happens, and nothing to act on at the
  // action either, so the row comes out live and the spec fails. It is also the
  // truthful sequence — an account is archived through a date and then goes on
  // being reconciled.
  sqlite: {
    setup: `UPDATE transactions SET is_cleared = 1
             WHERE id = '70000000-0000-0000-0000-000000000001';
            UPDATE accounts SET archive_through_date = '2024-06-30'
             WHERE id = 'a0000000-0000-0000-0000-000000000001';`,
    action: `UPDATE transactions SET is_reconciled = 1 WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    setup: `UPDATE public.transactions SET is_cleared = true
             WHERE id = '70000000-0000-0000-0000-000000000001';
            UPDATE public.accounts SET archive_through_date = '2024-06-30'
             WHERE id = 'a0000000-0000-0000-0000-000000000001';`,
    action: `UPDATE public.transactions SET is_reconciled = true WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'archived_by_the_sweep',
      sqlite: `SELECT archived FROM transactions WHERE id = '70000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT archived::int FROM public.transactions WHERE id = '70000000-0000-0000-0000-000000000001'`,
      expect: '1',
    },
  ],
};
