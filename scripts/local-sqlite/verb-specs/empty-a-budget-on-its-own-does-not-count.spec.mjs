import { USER, wiped } from './_shared.mjs';

export default {
  invariant: 'X-1',
  title: 'a budget on its own leaves the login empty, and that is the design',
  design: '20260807083000:117-126 names three tables and stops. MEASURED on the reference cluster: a login holding only a budget answers true',
  consequence: 'widening this to "is there any data" would refuse restores that are perfectly safe — none of the four hazards the precondition kills can be caused by a budget',
  parity: 'match',

  setup: {
    sqlite: `${wiped.sqlite}
      INSERT INTO budgets (id, user_id, name, amount_minor, period, start_date)
        VALUES ('b0000000-0000-0000-0000-0000000000f1', '${USER}', 'Food', 10000, 'monthly', '2024-01-01');`,
    postgres: `${wiped.postgres}
      INSERT INTO public.budgets (id, user_id, name, amount, period, start_date)
        VALUES ('b0000000-0000-0000-0000-0000000000f1', '${USER}', 'Food', 100.00, 'monthly', '2024-01-01');`,
  },
  command: { verb: 'user_financial_data_is_empty', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: { empty: true },
};
