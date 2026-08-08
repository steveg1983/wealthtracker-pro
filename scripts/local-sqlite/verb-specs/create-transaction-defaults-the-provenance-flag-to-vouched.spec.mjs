import { USER, EVERYDAY, WEEKLY_SHOP, balanceIdentityHolds } from './_shared.mjs';

const NEW_ROW = '70000000-0000-0000-0000-0000000000b4';

// The default is the important half. `COALESCE((p->>'category_confirmed')::boolean, true)`
// with the column also defaulting true, for the reason the migration gives:
// *"any writer that does not know about provenance produces a confirmed row,
// and existing history reads as confirmed"*.
//
// A port that defaulted to false would accuse every hand-entered transaction of
// being a guess — and would do it on the add-transaction form, which is the one
// place the user certainly did decide.
export default {
  invariant: 'TS-M3',
  title: 'a caller that says nothing about provenance produces a vouched row',
  design: 'supabase/migrations/20260808100000_category_provenance.sql:105-107 and :114-118',
  consequence: 'defaulting the other way turns every hand-typed category into a suggestion the user has to re-confirm',
  parity: 'match',

  command: {
    verb: 'create_transaction',
    payload: {
      id: NEW_ROW,
      user_id: USER,
      account_id: EVERYDAY,
      description: 'Typed in by hand',
      amount: '-5.00',
      type: 'expense',
      date: '2024-03-02',
      category: WEEKLY_SHOP,
    },
  },

  expect: { outcome: 'ok' },
  result: { category_confirmed: true },

  state: [
    balanceIdentityHolds(EVERYDAY),
    {
      name: 'rows_awaiting_confirmation',
      sqlite: 'SELECT COUNT(*) FROM transactions WHERE category_confirmed = 0',
      postgres: 'SELECT COUNT(*) FROM public.transactions WHERE NOT category_confirmed',
      expect: '0',
    },
  ],
};
