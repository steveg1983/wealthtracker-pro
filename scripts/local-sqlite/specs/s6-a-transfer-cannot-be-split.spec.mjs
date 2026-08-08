export default {
  invariant: 'S-6 / T-5',
  title: 'a transfer cannot also be a split',
  design: 'DESIGN.md §1.2 S-6 and §1.3 T-5 ("D — transactions_transfer_not_split"); cloud 20260713100000:153-155 and 20260806094058:177-179',
  consequence: 'the two sides of the transfer stop being comparable — one side is a single amount, the other a set of lines, and the pairing checks compare the wrong numbers',
  parity: 'divergent',
  reason: 'the cloud refuses this inside set_transaction_splits and set_transaction_splits_with_legs; nothing stops another writer. The local file makes it a CHECK.',

  sqlite: {
    action: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                                is_split, category, transfer_account_id)
      VALUES ('70000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'Split transfer', -1500, 'transfer', '2024-03-02',
              1, '', 'a0000000-0000-0000-0000-000000000002');`,
    expect: { outcome: 'refused', message: 'transactions_transfer_not_split' },
  },

  postgres: {
    action: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date,
                                       is_split, category, transfer_account_id)
      VALUES ('70000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'Split transfer', -15.00, 'transfer', '2024-03-02',
              true, '', 'a0000000-0000-0000-0000-000000000002');`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'split_transfers',
      sqlite: `SELECT COUNT(*) FROM transactions WHERE type = 'transfer' AND is_split = 1`,
      postgres: `SELECT COUNT(*) FROM public.transactions WHERE type = 'transfer' AND is_split`,
      expect: '1',
    },
  ],
};
