import { USER, transferPair, rowCount } from './_shared.mjs';

export default {
  invariant: 'X-2',
  title: 'a linked transfer pair does not stop a wipe — the defect this verb found',
  design: 'schema.sql trg_unnest_account_references, widened 2026-08-08. It nulls transfer_account_id in a BEFORE DELETE trigger (SQLite has no ON DELETE SET NULL (column)), which left a linked row half-cleared for one statement — a state transactions_linked_has_target, a CHECK this schema has and the cloud does not, refuses',
  consequence: 'before the fix, "delete everything" was refused outright on any file holding one linked transfer, which is every real file. No guard could have helped: the refusal was a CHECK, not a trigger',
  parity: 'match',

  setup: transferPair,
  command: {
    verb: 'wipe_user_financial_data',
    payload: { confirm: 'DELETE EVERYTHING', user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { accounts: 2, transactions: 0, categories: 3, budgets: 0, goals: 0, investments: 0 },
  state: [
    rowCount('accounts_left', 'accounts', '0'),
    rowCount('transactions_left', 'transactions', '0'),
  ],
};
