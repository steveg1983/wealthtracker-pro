import { USER } from './_shared.mjs';

export default {
  invariant: 'U-6',
  title: 'the restore-completed entry is a create locally and an update in the cloud',
  design: '20260807083000:432-436 writes action = update with before_data NULL. MEASURED: the cloud\'s financial_audit_log has exactly one CHECK, the action enumeration, so nothing there objects. This schema has three, and audit_update_has_both is one of them — MEASURED, that exact row is refused with "CHECK constraint failed: audit_update_has_both"',
  consequence: 'an entry claiming something was updated while refusing to say what it was before cannot answer the question the log exists for. A restore completing is a fact that did not exist and now does, which is what create means',
  parity: 'divergent',
  reason: 'U-6 is a LOCAL-ONLY rule (canonical #100 lists it as such): the local schema enforces "create has no before, delete has no after, update has both" and the cloud enforces none of it. The entity, the entity_id and the payload are identical on both engines; only the action differs, and it differs because one engine will not store the other\'s shape. Recorded rather than fixed in the cloud, because changing a live audit row\'s action is a migration with its own reasoning and this is a port.',

  command: { verb: 'finalize_user_restore', payload: { links: {}, user_id: USER } },
  expect: { outcome: 'ok' },
  result: { accounts_relinked: 0, transactions_relinked: 0 },
  state: [
    {
      name: 'the_entrys_action_and_before',
      sqlite: `SELECT action || '/' || CASE WHEN before_data IS NULL THEN 'no-before' ELSE 'before' END
                 FROM financial_audit_log WHERE json_extract(after_data, '$.event') = 'restore_completed'`,
      postgres: `SELECT action || '/' || CASE WHEN before_data IS NULL THEN 'no-before' ELSE 'before' END
                   FROM public.financial_audit_log WHERE after_data->>'event' = 'restore_completed'`,
      expect: { sqlite: 'create/no-before', postgres: 'update/no-before' },
    },
    {
      name: 'the_payload_is_the_same_either_way',
      sqlite: `SELECT json_extract(after_data, '$.event') || '/'
                 || CAST(json_extract(after_data, '$.accounts_relinked') AS TEXT) || '/'
                 || CAST(json_extract(after_data, '$.transactions_relinked') AS TEXT)
                 FROM financial_audit_log WHERE json_extract(after_data, '$.event') = 'restore_completed'`,
      postgres: `SELECT (after_data->>'event') || '/' || (after_data->>'accounts_relinked') || '/'
                   || (after_data->>'transactions_relinked')
                   FROM public.financial_audit_log WHERE after_data->>'event' = 'restore_completed'`,
      expect: 'restore_completed/0/0',
    },
  ],
};
