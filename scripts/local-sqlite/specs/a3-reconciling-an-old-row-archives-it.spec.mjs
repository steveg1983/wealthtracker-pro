export default {
  invariant: 'A-3',
  title: 'reconciling a row that is older than its account cutoff archives it',
  design: 'DESIGN.md §1.6 A-3 ("T"); cloud sweep_reconciled_into_archive, 20260721130000:123-148. §2.3 records the shape change: the cloud assigns NEW.archived in a BEFORE trigger, which SQLite cannot do, so the port issues a second UPDATE. The end state is the same; anything watching for a single-statement change sees two',
  consequence: 'old reconciled items linger in the live register forever, and the register the user scrolls stops matching the period they think they are looking at',
  parity: 'match',

  sqlite: {
    setup: `UPDATE accounts SET archive_through_date = '2024-06-30'
             WHERE id = 'a0000000-0000-0000-0000-000000000001';`,
    action: `UPDATE transactions SET is_cleared = 1 WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    setup: `UPDATE public.accounts SET archive_through_date = '2024-06-30'
             WHERE id = 'a0000000-0000-0000-0000-000000000001';`,
    action: `UPDATE public.transactions SET is_cleared = true WHERE id = '70000000-0000-0000-0000-000000000001';`,
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
