export default {
  invariant: 'U-6',
  title: 'a created row has no "before"',
  design: 'DESIGN.md §1.7 U-6 ("D — three CHECKs. The cloud does not enforce this")',
  consequence: 'an audit entry that claims a creation had a previous state describes something that never happened, and a reader cannot tell which half to believe',
  parity: 'divergent',
  reason: 'the cloud accepts any combination of before/after against any action; the shape is only ever right because write_financial_audit is careful. The local file makes it a CHECK.',

  sqlite: {
    action: `
      INSERT INTO financial_audit_log (id, user_id, entity, entity_id, action, before_data, after_data, seq, row_hash)
      VALUES ('f0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
              'transaction', '70000000-0000-0000-0000-000000000001', 'create',
              '{"amount_minor":-1}', '{"amount_minor":-2500}', 1, 'hash-1');`,
    expect: { outcome: 'refused', message: 'audit_create_has_no_before' },
  },

  postgres: {
    action: `
      INSERT INTO public.financial_audit_log (id, user_id, entity, entity_id, action, before_data, after_data)
      VALUES ('f0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
              'transaction', '70000000-0000-0000-0000-000000000001', 'create',
              '{"amount":-0.01}', '{"amount":-25.00}');`,
    expect: { outcome: 'accepted' },
  },

  verify: [
    {
      name: 'creations_claiming_a_previous_state',
      sqlite: `SELECT COUNT(*) FROM financial_audit_log WHERE action = 'create' AND before_data IS NOT NULL`,
      postgres: `SELECT COUNT(*) FROM public.financial_audit_log WHERE action = 'create' AND before_data IS NOT NULL`,
      expect: '1',
    },
  ],
};
