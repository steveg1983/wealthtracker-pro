import { USER } from './_shared.mjs';

export default {
  invariant: 'U-1',
  title: 'a wipe is audited row by row, before the rows stop existing to describe',
  design: '20260807083000:168-177 and its own reasoning at :70-71 — the restore writes ONE entry for the whole operation and the wipe writes one PER ROW, because here the per-row answer differs and it is the thing a user would later need to reconstruct',
  consequence: 'a delete with no before-image is a delete nobody can undo or explain; the audit log is the only thing left that can say what was there',
  parity: 'match',

  command: {
    verb: 'wipe_user_financial_data',
    payload: { confirm: 'DELETE EVERYTHING', user_id: USER },
  },
  expect: { outcome: 'ok' },
  state: [
    {
      // One transaction and two accounts, every one a delete, every one carrying
      // what the row held. U-6: a delete has no `after`.
      name: 'audit_shape',
      sqlite: `SELECT COUNT(*) || '/' || SUM(action = 'delete') || '/'
                 || SUM(before_data IS NOT NULL) || '/' || SUM(after_data IS NOT NULL)
                 FROM financial_audit_log WHERE user_id = '${USER}'`,
      postgres: `SELECT COUNT(*) || '/' || COUNT(*) FILTER (WHERE action = 'delete') || '/'
                   || COUNT(*) FILTER (WHERE before_data IS NOT NULL) || '/'
                   || COUNT(*) FILTER (WHERE after_data IS NOT NULL)
                   FROM public.financial_audit_log WHERE user_id = '${USER}'`,
      expect: '3/3/3/0',
    },
    {
      name: 'audited_entities',
      sqlite: `SELECT group_concat(entity, ',') FROM (
                 SELECT entity FROM financial_audit_log WHERE user_id = '${USER}' ORDER BY entity, entity_id)`,
      postgres: `SELECT string_agg(entity, ',' ORDER BY entity, entity_id::text)
                   FROM public.financial_audit_log WHERE user_id = '${USER}'`,
      expect: 'account,account,transaction',
    },
  ],
};
