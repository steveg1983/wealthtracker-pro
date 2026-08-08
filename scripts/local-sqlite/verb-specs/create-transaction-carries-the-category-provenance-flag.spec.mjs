import { USER, EVERYDAY, WEEKLY_SHOP, balanceIdentityHolds } from './_shared.mjs';

const GUESSED = '70000000-0000-0000-0000-0000000000b3';

// `category_confirmed` records WHO decided, never WHAT was decided
// (20260808100000:104-107). false = the app guessed and nobody has agreed yet.
// Only an importer that knows it guessed sends false.
//
// The flag is worth a differential spec rather than a Rust unit test because it
// arrived in the same migration wave as `statement_sequence`, and the two
// migrations demonstrate opposite outcomes of the same rebase problem: one added
// its column cleanly, the other added its column and dropped somebody else's.
export default {
  invariant: 'TS-M3',
  title: 'a category the app guessed arrives unconfirmed and stays unconfirmed',
  design: 'supabase/migrations/20260808100000_category_provenance.sql:119-183, COALESCE((p->>\'category_confirmed\')::boolean, true)',
  consequence: 'losing the flag makes every guessed category look like the user\'s own choice, and the confirm-this-suggestion screen has nothing to show',
  parity: 'match',

  command: {
    verb: 'create_transaction',
    payload: {
      id: GUESSED,
      user_id: USER,
      account_id: EVERYDAY,
      description: 'Categorised by the smart categoriser, not by a human',
      amount: '-8.75',
      type: 'expense',
      date: '2024-03-02',
      category: WEEKLY_SHOP,
      category_confirmed: false,
    },
  },

  expect: { outcome: 'ok' },
  result: { category_confirmed: false, category: WEEKLY_SHOP },

  state: [
    balanceIdentityHolds(EVERYDAY),
    {
      name: 'rows_awaiting_confirmation',
      sqlite: `SELECT COUNT(*) FROM transactions WHERE category_confirmed = 0`,
      postgres: `SELECT COUNT(*) FROM public.transactions WHERE NOT category_confirmed`,
      expect: '1',
    },
    {
      name: 'audit_after_carries_the_provenance_flag',
      sqlite: `SELECT CASE json_extract(after_data, '$.category_confirmed')
                        WHEN 0 THEN 'guessed' ELSE 'vouched' END
                 FROM financial_audit_log WHERE entity_id = '${GUESSED}'`,
      postgres: `SELECT CASE (after_data->>'category_confirmed')::boolean
                          WHEN false THEN 'guessed' ELSE 'vouched' END
                   FROM public.financial_audit_log WHERE entity_id = '${GUESSED}'`,
      expect: 'guessed',
    },
  ],
};
