export default {
  invariant: 'U-3',
  title: 'the app cannot rewrite an audit row',
  design: 'DESIGN.md §1.7 U-3 and §7.6; cloud enforces it with absent RLS policies + SECURITY DEFINER, 20260610150000:35-43',
  consequence: 'history can be edited to agree with whatever the balance currently says, which is the one thing an audit log must not allow',
  parity: 'not-comparable',
  reason: 'the cloud property is RLS-shaped, and scripts/local-db connects as superuser — its own README concedes "RLS is created but never exercised". Locally the property is tamper-EVIDENT (trigger plus hash chain), not tamper-proof: the user owns the file. The two properties are different claims, so this is proved on one engine and asserted as nothing on the other.',

  sqlite: {
    setup: `
      INSERT INTO financial_audit_log (id, user_id, entity, entity_id, action, after_data, seq, row_hash)
      VALUES ('f0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
              'transaction', '70000000-0000-0000-0000-000000000001', 'create', '{"amount_minor":-2500}',
              1, 'hash-1');`,
    action: `UPDATE financial_audit_log SET after_data = '{"amount_minor":-1}'
              WHERE id = 'f0000000-0000-0000-0000-000000000003';`,
    expect: { outcome: 'refused', message: 'audit_immutable' },
  },

  postgres: {
    skip: 'immutability here is the absence of an RLS policy; psql is superuser, so the harness cannot exercise it. npm run test:supabase-smoke is where that property lives.',
  },
};
