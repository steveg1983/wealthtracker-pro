import { USER, CORNER_SHOP, OTHER_LEG } from './_shared.mjs';

export default {
  invariant: 'X-6',
  title: 'a link naming a row this login does not have relinks nothing and refuses nothing',
  design: '20260807083000:419-429 — every UPDATE carries AND user_id = v_owner, and the count comes from ROW_COUNT. MEASURED: 0 relinked, no exception',
  consequence: 'a bundle can carry a link to a row the restore skipped or the file lost; refusing the whole finalize over one would strand every OTHER link in the same call',
  parity: 'match',

  command: {
    verb: 'finalize_user_restore',
    payload: {
      links: {
        transaction_links: [
          { id: '70000000-0000-0000-0000-0000000000ff', linked_transfer_id: OTHER_LEG },
        ],
      },
      user_id: USER,
    },
  },
  expect: { outcome: 'ok' },
  result: { accounts_relinked: 0, transactions_relinked: 0 },
  state: [
    {
      name: 'the_fixture_row_is_untouched',
      sqlite: `SELECT COALESCE(linked_transfer_id, 'NONE') FROM transactions WHERE id = '${CORNER_SHOP}'`,
      postgres: `SELECT COALESCE(linked_transfer_id::text, 'NONE') FROM public.transactions WHERE id = '${CORNER_SHOP}'`,
      expect: 'NONE',
    },
  ],
};
