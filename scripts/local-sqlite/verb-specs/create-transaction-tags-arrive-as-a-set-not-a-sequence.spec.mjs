import { USER, EVERYDAY, balanceIdentityHolds } from './_shared.mjs';

const NEW_ROW = '70000000-0000-0000-0000-0000000000b7';

// A SHAPE DIFFERENCE THE DESIGN DOES NOT MENTION, found by writing this spec.
//
// `transactions.tags` is `text[]` in the cloud — an ORDERED list, and Postgres
// returns it in the order it was written. `schema.sql` makes it a child table,
// `transaction_tags`, keyed `(transaction_id, tag)` — which is a SET: it has no
// order column, so it cannot preserve one, and it silently de-duplicates where
// the array would keep both copies.
//
// Neither DESIGN.md §3 nor PHASE1-PLAN mentions the conversion. Consequences,
// in the order they will bite:
//   1. order is lost;
//   2. duplicate tags collapse (the array keeps them, the PRIMARY KEY does not);
//   3. a cloud→local restore of a row with duplicate tags therefore changes it.
//
// This is not worth changing the schema for — a tag list is a set in every
// place the UI uses it — but it IS worth knowing, and a restore has to decide
// what to do with (2). The harness sorts both sides before comparing, so this
// spec asserts the property that survives (membership) and names the one that
// does not (order).
export default {
  invariant: 'R-4',
  title: 'tags survive the round trip as a set: membership is preserved, order is not',
  design: 'transactions.tags text[] in the cloud; schema.sql transaction_tags (transaction_id, tag) PRIMARY KEY locally',
  consequence: 'a restore that assumes ordered, duplicable tags will quietly rewrite them',
  parity: 'match',

  command: {
    verb: 'create_transaction',
    payload: {
      id: NEW_ROW,
      user_id: USER,
      account_id: EVERYDAY,
      description: 'Tagged twice over',
      amount: '-6.00',
      type: 'expense',
      date: '2024-03-02',
      // Deliberately already in sorted order, so this spec measures membership
      // and not the harness's own sort.
      tags: ['groceries', 'weekly'],
    },
  },

  expect: { outcome: 'ok' },
  result: { tags: ['groceries', 'weekly'] },

  state: [
    balanceIdentityHolds(EVERYDAY),
    {
      name: 'tags_stored',
      sqlite: `SELECT group_concat(tag, ',') FROM (
                 SELECT tag FROM transaction_tags WHERE transaction_id = '${NEW_ROW}' ORDER BY tag)`,
      postgres: `SELECT array_to_string(ARRAY(SELECT unnest(tags) ORDER BY 1), ',')
                   FROM public.transactions WHERE id = '${NEW_ROW}'`,
      expect: 'groceries,weekly',
    },
  ],
};
