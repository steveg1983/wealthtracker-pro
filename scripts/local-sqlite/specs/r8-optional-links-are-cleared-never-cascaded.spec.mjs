export default {
  invariant: 'R-8',
  title: 'a goal contribution outlives the transaction it came from, and a budget outlives its category',
  design: 'DESIGN.md §1.8 R-8 ("D"); cloud initial-schema.sql:1788, :1804, :1732',
  consequence: 'a cascade here would delete a savings record because the transaction behind it was tidied up, and quietly reduce the goal',
  parity: 'match',

  sqlite: {
    setup: `
      INSERT INTO goals (id, user_id, name, target_amount_minor, current_amount_minor)
      VALUES ('90000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
              'New boiler', 250000, 2500);
      INSERT INTO goal_contributions (id, goal_id, user_id, amount_minor, transaction_id, date)
      VALUES ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001',
              '11111111-1111-1111-1111-111111111111', 2500,
              '70000000-0000-0000-0000-000000000001', '2024-03-01');
      INSERT INTO budgets (id, user_id, name, amount_minor, period, category_id, start_date)
      VALUES ('92000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
              'Food budget', 20000, 'monthly', 'c0000000-0000-0000-0000-000000000003', '2024-03-01');`,
    action: `
      DELETE FROM transactions WHERE id = '70000000-0000-0000-0000-000000000001';
      DELETE FROM categories WHERE id = 'c0000000-0000-0000-0000-000000000003';`,
    expect: { outcome: 'accepted' },
  },

  postgres: {
    setup: `
      INSERT INTO public.goals (id, user_id, name, target_amount, current_amount)
      VALUES ('90000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
              'New boiler', 2500.00, 25.00);
      INSERT INTO public.goal_contributions (id, goal_id, user_id, amount, transaction_id, date)
      VALUES ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001',
              '11111111-1111-1111-1111-111111111111', 25.00,
              '70000000-0000-0000-0000-000000000001', '2024-03-01');
      INSERT INTO public.budgets (id, user_id, name, amount, period, category_id, start_date)
      VALUES ('92000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
              'Food budget', 200.00, 'monthly', 'c0000000-0000-0000-0000-000000000003', '2024-03-01');`,
    action: `
      DELETE FROM public.transactions WHERE id = '70000000-0000-0000-0000-000000000001';
      DELETE FROM public.categories WHERE id = 'c0000000-0000-0000-0000-000000000003';`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'contribution_survives_unlinked',
      sqlite: `SELECT COUNT(*) FROM goal_contributions
                WHERE id = '91000000-0000-0000-0000-000000000001' AND transaction_id IS NULL`,
      postgres: `SELECT COUNT(*) FROM public.goal_contributions
                  WHERE id = '91000000-0000-0000-0000-000000000001' AND transaction_id IS NULL`,
      expect: '1',
    },
    {
      name: 'budget_survives_uncategorised',
      sqlite: `SELECT COUNT(*) FROM budgets
                WHERE id = '92000000-0000-0000-0000-000000000001' AND category_id IS NULL`,
      postgres: `SELECT COUNT(*) FROM public.budgets
                  WHERE id = '92000000-0000-0000-0000-000000000001' AND category_id IS NULL`,
      expect: '1',
    },
  ],
};
