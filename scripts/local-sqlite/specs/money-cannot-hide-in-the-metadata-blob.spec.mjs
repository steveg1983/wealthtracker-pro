export default {
  invariant: 'MONEY-3',
  title: 'a figure cannot be smuggled back into the metadata blob',
  design: 'DESIGN.md §3.3 and divergence #9; schema.sql transactions_no_money_in_metadata',
  consequence: 'src/types/index.ts:152-203 declares sixteen untyped `number` fields inside this blob. Every one is an IEEE-754 double by the time it reaches JSON, and none is bounded, typed or auditable',
  parity: 'divergent',
  reason: 'DESIGN.md calls this "the divergence most likely to bite": restoring an old cloud backup WILL fail this constraint until the importer strips or promotes the money keys. That is a required restore-path step, and this spec is the proof it is needed.',

  sqlite: {
    action: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date, metadata)
      VALUES ('70000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'With fees', -5000, 'expense', '2024-06-02',
              '{"transferMetadata":{"fees":1.25}}');`,
    expect: { outcome: 'refused', message: 'transactions_no_money_in_metadata' },
  },

  postgres: {
    action: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date, metadata)
      VALUES ('70000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'With fees', -50.00, 'expense', '2024-06-02',
              '{"transferMetadata":{"fees":1.25}}');`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'money_in_the_blob',
      sqlite: `SELECT COUNT(*) FROM transactions
                WHERE json_extract(metadata, '$.transferMetadata.fees') IS NOT NULL`,
      postgres: `SELECT COUNT(*) FROM public.transactions
                  WHERE metadata -> 'transferMetadata' ->> 'fees' IS NOT NULL`,
      expect: '1',
    },
  ],
};
