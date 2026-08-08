import {
  CORNER_SHOP, EVERYDAY, PRUNABLE, filedUnderThePrunableByUuidAlone, prunablePair, setups,
  balanceIdentityHolds, categoryPresent, filedAs,
} from './_shared.mjs';

export default {
  invariant: 'C-7',
  title: 'the transaction check reads the TEXT column only — a uuid-only reference does not save it',
  design: '20260713100000:336-339 reads `t.category = c.id::text` and nothing else, while the budget check two clauses later reads BOTH `b.category` and `b.category_id`. The asymmetry is in the cloud\'s own WHERE clause',
  consequence: 'the category is deleted and the foreign key nulls the uuid column, so the row loses its filing silently and with no text left behind to say what it was — the one case in this family where even verify_integrity has nothing to report, because a NULL is not a dangler',
  parity: 'match',

  // MEASURED on both engines (probe-prune1.sh p-used-by-transaction-uuid-only,
  // probe-prune-sqlite3.mjs c-used-by-transaction-uuid-only). Reproduced rather
  // than fixed: a local port that also checked category_id would refuse a prune
  // the cloud performs.
  setup: setups(prunablePair, filedUnderThePrunableByUuidAlone),
  command: { verb: 'delete_unused_categories', payload: { ids: [PRUNABLE], user_id: null } },
  expect: { outcome: 'ok' },
  result: { deleted: 1 },
  state: [
    categoryPresent(PRUNABLE, 'GONE'),
    filedAs(CORNER_SHOP, 'NULL/NULL'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
