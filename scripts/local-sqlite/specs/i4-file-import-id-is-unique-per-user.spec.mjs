export default {
  invariant: 'I-4',
  title: 'the same row from the same file cannot be imported twice',
  design: 'DESIGN.md §1.5 I-4 ("D"); cloud UNIQUE (user_id, import_source, import_source_id), 20260722170000:67-68, rationale at :34-39',
  consequence: 'importing a statement a second time doubles every figure in it — the failure users notice last and trust least',
  parity: 'match',

  sqlite: {
    setup: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                                import_source, import_source_id)
      VALUES ('70000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'From file', -900, 'expense', '2024-05-02',
              'qif', 'row-7');`,
    action: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                                import_source, import_source_id)
      VALUES ('70000000-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'From file again', -900, 'expense', '2024-05-02',
              'qif', 'row-7');`,
    expect: {
      outcome: 'refused',
      message: 'UNIQUE constraint failed: transactions.user_id, transactions.import_source, transactions.import_source_id',
    },
  },

  postgres: {
    setup: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date,
                                       import_source, import_source_id)
      VALUES ('70000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'From file', -9.00, 'expense', '2024-05-02',
              'qif', 'row-7');`,
    action: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date,
                                       import_source, import_source_id)
      VALUES ('70000000-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'From file again', -9.00, 'expense', '2024-05-02',
              'qif', 'row-7');`,
    expect: { outcome: 'refused', message: 'transactions_import_source_unique' },
  },
};
