export default {
  invariant: 'V',
  title: 'the fixture every other spec starts from reports nothing at all',
  design: 'schema.sql v_integrity_violations — seventeen checks, and the only interesting answer is the empty one',
  consequence: 'a checker that reports something about a healthy file is a checker nobody reads, and the one time it matters it will be scrolled past',
  parity: 'not-comparable',
  reason: 'the cloud has no verify_integrity, no view and no equivalent — traced in the verb module: grep over supabase/, api/ and src/ finds nothing, and supabase/migrations/ contains no CREATE VIEW at all',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: { ok: true, violations: 0, warnings: 0, findings: [] },
  state: [
    { name: 'v_integrity_ok', sqlite: "SELECT CASE WHEN (SELECT ok FROM v_integrity_ok) = 1 THEN 'ok' ELSE 'not-ok' END", expect: 'ok' },
  ],
};
