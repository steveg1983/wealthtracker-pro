import { USER, EVERYDAY, RAINY_DAY } from './_shared.mjs';

export default {
  invariant: 'X-9',
  title: 'a null parent is skipped, so only rows that genuinely carry a link are touched',
  design: '20260807083000:415 — AND l.parent_account_id IS NOT NULL, and the comment at :381-383 says why: these are UPDATEs, "so only rows that genuinely carry a link are updated, rather than the whole table"',
  consequence: 'writing NULL over NULL still counts as an update, which would re-date every account in the file and inflate the number the client reports back to the user',
  parity: 'match',

  command: {
    verb: 'finalize_user_restore',
    payload: {
      links: {
        account_parents: [
          { id: EVERYDAY, parent_account_id: null },
          { id: RAINY_DAY, parent_account_id: EVERYDAY },
        ],
      },
      user_id: USER,
    },
  },
  expect: { outcome: 'ok' },
  result: { accounts_relinked: 1, transactions_relinked: 0 },
  state: [
    {
      name: 'the_nesting',
      sqlite: `SELECT COALESCE(parent_account_id, 'NONE') FROM accounts WHERE id = '${RAINY_DAY}'`,
      postgres: `SELECT COALESCE(parent_account_id::text, 'NONE') FROM public.accounts WHERE id = '${RAINY_DAY}'`,
      expect: EVERYDAY,
    },
  ],
};
