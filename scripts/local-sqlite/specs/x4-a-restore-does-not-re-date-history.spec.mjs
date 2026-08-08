export default {
  invariant: 'X-4',
  title: 'a restore keeps the dates the rows already had',
  design: 'DESIGN.md §1.9 X-4 ("T"); cloud stands update_updated_at_column down while app.restore_in_progress is set, 20260807083000:87-99. Locally the same exemption is _rpc_guard(\'restore\') in each trigger\'s WHEN clause',
  consequence: 'quoting the migration that introduced it: a backup that returns a decade of transfers dated today is not a backup',
  parity: 'match',

  sqlite: {
    // Writing updated_at explicitly does not fire the trigger — its WHEN clause
    // is "NEW.updated_at IS OLD.updated_at", i.e. only stamp when the writer
    // did not. That is what makes this setup honest rather than a workaround.
    setup: `UPDATE transactions SET updated_at = '2019-01-01T00:00:00.000Z'
             WHERE id = '70000000-0000-0000-0000-000000000001';`,
    action: `
      INSERT INTO _rpc_guard VALUES ('restore');
      UPDATE transactions SET description = 'Corner shop (restored)'
       WHERE id = '70000000-0000-0000-0000-000000000001';
      DELETE FROM _rpc_guard;`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    setup: `
      SELECT set_config('app.restore_in_progress', '1', true);
      UPDATE public.transactions SET updated_at = '2019-01-01T00:00:00Z'
       WHERE id = '70000000-0000-0000-0000-000000000001';
      SELECT set_config('app.restore_in_progress', '0', true);`,
    action: `
      SELECT set_config('app.restore_in_progress', '1', true);
      UPDATE public.transactions SET description = 'Corner shop (restored)'
       WHERE id = '70000000-0000-0000-0000-000000000001';
      SELECT set_config('app.restore_in_progress', '0', true);`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'updated_at_day',
      sqlite: `SELECT substr(updated_at, 1, 10) FROM transactions
                WHERE id = '70000000-0000-0000-0000-000000000001'`,
      postgres: `SELECT to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') FROM public.transactions
                  WHERE id = '70000000-0000-0000-0000-000000000001'`,
      expect: '2019-01-01',
    },
  ],
};
