import { USER, FUEL_BUDGET, twoBudgets, auditRowsInTotal } from './_shared.mjs';

export default {
  invariant: 'READ-6',
  title: 'a paused budget is greyed out on the page, not missing from the answer',
  design: 'getBudgets says it in its own comment: "Inactive budgets load too: pausing a budget greys it out on the page (which filters on isActive where it matters), it must not make the budget vanish with no way to reactivate it." There is no is_active filter in the query',
  consequence: 'filter here and pausing a budget deletes it as far as the user can tell — the row is in the file, the page cannot show it, and there is no control anywhere that would bring it back',
  parity: 'match',

  setup: twoBudgets,
  command: { verb: 'list_budgets', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  state: [
    auditRowsInTotal('0'),
    {
      name: 'the_paused_budget_is_stored_paused',
      sqlite: `SELECT CASE WHEN is_active = 1 THEN 'live' ELSE 'paused' END
                 FROM budgets WHERE id = '${FUEL_BUDGET}'`,
      postgres: `SELECT CASE WHEN is_active THEN 'live' ELSE 'paused' END
                   FROM public.budgets WHERE id = '${FUEL_BUDGET}'`,
      expect: 'paused',
    },
  ],
};
