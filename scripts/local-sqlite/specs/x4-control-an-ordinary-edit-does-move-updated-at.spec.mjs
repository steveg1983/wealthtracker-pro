// THE CONTROL for X-4. If the restore exemption is doing its job, an ordinary
// edit must still stamp updated_at. A trigger that never fires would pass the
// X-4 spec perfectly and be worthless.
export default {
  invariant: 'X-4',
  title: 'an ordinary edit still moves updated_at',
  design: 'DESIGN.md §2.3 — the AFTER UPDATE port of update_updated_at_column, safe only because PRAGMA recursive_triggers is OFF',
  consequence: 'without this, "when did this last change" is answered by the creation date forever, and sync/merge logic that trusts it silently keeps the wrong side',
  parity: 'match',

  sqlite: {
    setup: `UPDATE transactions SET updated_at = '2019-01-01T00:00:00.000Z'
             WHERE id = '70000000-0000-0000-0000-000000000001';`,
    action: `UPDATE transactions SET description = 'Corner shop (edited)'
              WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    setup: `
      SELECT set_config('app.restore_in_progress', '1', true);
      UPDATE public.transactions SET updated_at = '2019-01-01T00:00:00Z'
       WHERE id = '70000000-0000-0000-0000-000000000001';
      SELECT set_config('app.restore_in_progress', '0', true);`,
    action: `UPDATE public.transactions SET description = 'Corner shop (edited)'
              WHERE id = '70000000-0000-0000-0000-000000000001';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'updated_at_moved_off_the_planted_date',
      sqlite: `SELECT CASE WHEN updated_at > '2019-01-02' THEN 'MOVED' ELSE 'STUCK' END
                 FROM transactions WHERE id = '70000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT CASE WHEN updated_at > timestamptz '2019-01-02' THEN 'MOVED' ELSE 'STUCK' END
                   FROM public.transactions WHERE id = '70000000-0000-0000-0000-000000000001'`,
      expect: 'MOVED',
    },
  ],
};
