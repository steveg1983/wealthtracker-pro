export default {
  invariant: 'T-2',
  title: 'a transfer cannot name its own account as the other side',
  design: 'DESIGN.md §1.3 T-2 ("D — transactions_transfer_two_accounts"); cloud 20260716100000:105-107',
  consequence: 'money appears to leave and arrive in the same account: the balance is right by accident and the transfer report is nonsense',
  parity: 'divergent',
  reason: 'the cloud checks this inside link_transfer_pair only; a direct write is accepted. The local file makes it a CHECK.',

  sqlite: {
    action: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date, transfer_account_id)
      VALUES ('70000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'To itself', -1500, 'transfer', '2024-04-02',
              'a0000000-0000-0000-0000-000000000001');`,
    expect: { outcome: 'refused', message: 'transactions_transfer_two_accounts' },
  },

  postgres: {
    action: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date, transfer_account_id)
      VALUES ('70000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111',
              'a0000000-0000-0000-0000-000000000001', 'To itself', -15.00, 'transfer', '2024-04-02',
              'a0000000-0000-0000-0000-000000000001');`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'self_transfers',
      sqlite: `SELECT COUNT(*) FROM transactions WHERE transfer_account_id = account_id`,
      postgres: `SELECT COUNT(*) FROM public.transactions WHERE transfer_account_id = account_id`,
      expect: '1',
    },
  ],
};
