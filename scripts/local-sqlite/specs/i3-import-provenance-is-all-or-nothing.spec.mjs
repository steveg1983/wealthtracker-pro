export default {
  invariant: 'I-3',
  title: 'a row imported from a file names both the source and the id within it',
  design: 'DESIGN.md §1.5 I-3 ("D"); cloud CHECK at 20260722170000:60-63',
  consequence: 'a half-attributed row cannot be deduped, so re-running the same file imports it again',
  parity: 'match',

  sqlite: {
    action: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date, import_source)
      VALUES ('70000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'Imported', -900, 'expense', '2024-05-02', 'qif');`,
    expect: { outcome: 'refused', message: 'transactions_import_provenance_complete' },
  },

  postgres: {
    action: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date, import_source)
      VALUES ('70000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'Imported', -9.00, 'expense', '2024-05-02', 'qif');`,
    expect: { outcome: 'refused', message: 'transactions_import_provenance_complete' },
  },
};
