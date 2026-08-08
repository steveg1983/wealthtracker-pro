import { USER } from './_shared.mjs';

export default {
  invariant: 'U-1',
  title: 'a finalize with no links relinks nothing and still writes its one entry',
  design: '20260807083000:432-439 — the audit write is unconditional, because the fact it records is that a restore COMPLETED, not that a link moved',
  consequence: 'a restore that left no trace in the log would be the one operation in the product that can replace every row a person owns and say nothing about it',
  parity: 'match',

  command: { verb: 'finalize_user_restore', payload: { links: {}, user_id: USER } },
  expect: { outcome: 'ok' },
  result: { accounts_relinked: 0, transactions_relinked: 0 },
  state: [
    {
      name: 'the_entry_exists',
      sqlite: `SELECT COUNT(*) FROM financial_audit_log
                WHERE user_id = '${USER}' AND json_extract(after_data, '$.event') = 'restore_completed'`,
      postgres: `SELECT COUNT(*) FROM public.financial_audit_log
                  WHERE user_id = '${USER}' AND after_data->>'event' = 'restore_completed'`,
      expect: '1',
    },
    {
      // The cloud files it against `account`, with the USER's id in a column
      // that names an account. Kept: the entry is about the login rather than
      // about any one account, and changing it would make the two logs disagree
      // about which row a restore happened to.
      name: 'what_it_is_filed_against',
      sqlite: `SELECT entity || '/' || entity_id FROM financial_audit_log
                WHERE json_extract(after_data, '$.event') = 'restore_completed'`,
      postgres: `SELECT entity || '/' || entity_id::text FROM public.financial_audit_log
                  WHERE after_data->>'event' = 'restore_completed'`,
      expect: `account/${USER}`,
    },
  ],
};
