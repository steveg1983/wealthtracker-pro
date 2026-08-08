export default {
  invariant: 'U-2',
  title: 'an audit row records a create, an update or a delete — nothing else',
  design: 'DESIGN.md §1.7 U-2 ("D"); cloud CHECK at 20260610150000:26-27',
  consequence: 'a log with unknown verbs cannot answer "what changed this figure", which is the only question it exists for',
  parity: 'match',

  sqlite: {
    action: `
      INSERT INTO financial_audit_log (id, user_id, entity, entity_id, action, after_data, seq, row_hash)
      VALUES ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
              'transaction', '70000000-0000-0000-0000-000000000001', 'purge', '{}', 1, 'hash-1');`,
    // SQLite names the expression, not the constraint, because this CHECK is
    // inline and unnamed in schema.sql. See README, "reading a refusal".
    expect: { outcome: 'refused', message: "CHECK constraint failed: action IN ('create','update','delete')" },
  },

  postgres: {
    action: `
      INSERT INTO public.financial_audit_log (id, user_id, entity, entity_id, action, after_data)
      VALUES ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
              'transaction', '70000000-0000-0000-0000-000000000001', 'purge', '{}');`,
    expect: { outcome: 'refused', message: 'financial_audit_log_action_check' },
  },
};
