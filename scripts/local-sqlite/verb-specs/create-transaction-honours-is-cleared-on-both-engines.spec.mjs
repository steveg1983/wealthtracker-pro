import { USER, EVERYDAY, balanceIdentityHolds, storedFlag } from './_shared.mjs';

const NEW_ROW = '70000000-0000-0000-0000-0000000000b5';

// THE TRIPWIRE, FLIPPED. This file used to assert the opposite, and the reason
// it did is worth keeping in front of whoever reads it next.
//
// What happened, traced through the migrations:
//
//   20260707120000:117-172  create_transaction_atomic gains `is_cleared` in its
//                           column list, with COALESCE(...,false). Its header
//                           says: "These definitions are copied from the LATEST
//                           live versions."
//   20260808090000:96-98    "Identical to the definition in 20260610150000_
//                           financial_audit_log.sql except for the
//                           statement_sequence column."  — but 20260610150000
//                           was NOT the live definition any more; 20260707120000
//                           was. The rebase used the older base and the
//                           `is_cleared` passthrough vanished with it.
//   20260808100000:114-183  inherits the loss while adding category_confirmed.
//
// MEASURED on the reference cluster, 2026-08-08: `"is_cleared": true` in,
// `is_cleared = f` out, no error — the column defaults FALSE (20260310000200:13),
// so nothing raises and the flag is simply dropped.
//
// The first port of this verb reproduced the bug on purpose, on the argument
// that a documented shared defect beats two editions disagreeing about whether a
// row stays reconciled. 20260808150000_create_honours_is_cleared.sql retires
// that argument by repairing the cloud, so this spec now asserts the behaviour
// both engines SHOULD have and both engines DO have.
//
// Scope, stated plainly: "postgres" here is the reference cluster, which
// scripts/local-db/up.sh rebuilds from the full migration history including the
// new file. PRODUCTION still drops the flag until the owner applies it. That
// order is deliberate — the differential proof is what makes applying it safe —
// and this spec is what will keep saying so if the repair is ever rebased away
// by the same mistake a second time.
export default {
  invariant: 'I-9',
  title: 'a row asked to arrive reconciled arrives reconciled — on both engines',
  design: 'regression introduced at 20260808090000:96-98 by rebasing onto 20260610150000 instead of the live 20260707120000; repaired at 20260808150000',
  consequence: 'without it, a reconciled row lands unreconciled with no error, and the reconciliation screen shows work that was already done — the 2026-07 incident (20260707120000:5-11) a second time',
  parity: 'match',

  command: {
    verb: 'create_transaction',
    payload: {
      id: NEW_ROW,
      user_id: USER,
      account_id: EVERYDAY,
      description: 'Asked to arrive reconciled',
      amount: '-15.00',
      type: 'expense',
      date: '2024-03-02',
      is_cleared: true,
    },
  },

  expect: { outcome: 'ok' },
  result: { is_cleared: true },

  state: [
    balanceIdentityHolds(EVERYDAY),
    storedFlag(NEW_ROW, 'is_cleared', 'yes'),
    {
      // The row that was already there is untouched: this verb reconciles what
      // it is told to and nothing else.
      name: 'reconciled_rows',
      sqlite: 'SELECT COUNT(*) FROM transactions WHERE is_cleared = 1',
      postgres: 'SELECT COUNT(*) FROM public.transactions WHERE is_cleared',
      expect: '1',
    },
  ],
};
