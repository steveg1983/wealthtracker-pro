export default {
  invariant: 'MONEY-4',
  title: 'an amount in another currency is useless without the rate that converted it',
  design: 'DESIGN.md §3.3: the FX triple is promoted out of the blob into typed columns and given an all-or-nothing CHECK',
  consequence: 'a row that says "this was 100 of something else" with no rate and no currency cannot be reconciled, reported or converted back — the figure is unrecoverable',
  parity: 'divergent',
  reason: 'in the cloud these three values live inside metadata as untyped JSON numbers, where nothing at all is enforced — DESIGN.md §3.3 notes exchange_rate does not exist as a column in any migration. The equivalent cloud write is simply accepted.',

  sqlite: {
    action: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                                original_amount_minor)
      VALUES ('70000000-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'Abroad', -5000, 'expense', '2024-06-03', -6000);`,
    expect: { outcome: 'refused', message: 'transactions_fx_complete' },
  },

  postgres: {
    action: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date, metadata)
      VALUES ('70000000-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'Abroad', -50.00, 'expense', '2024-06-03',
              '{"transferMetadata":{"originalAmount":60.00}}');`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'converted_amounts_with_no_rate',
      sqlite: `SELECT COUNT(*) FROM transactions
                WHERE original_amount_minor IS NOT NULL AND fx_rate_e10 IS NULL`,
      postgres: `SELECT COUNT(*) FROM public.transactions
                  WHERE metadata -> 'transferMetadata' ->> 'originalAmount' IS NOT NULL
                    AND metadata -> 'transferMetadata' ->> 'exchangeRate' IS NULL`,
      expect: '1',
    },
  ],
};
