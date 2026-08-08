import { USER, EVERYDAY, storedBalances } from './_shared.mjs';

export default {
  invariant: 'B-1',
  title: 'a snap to the balance the account already holds shifts nothing, and is still audited',
  design: '20260613090000:205-216 — the arithmetic is unconditional and so is the audit write. MEASURED: initial_balance stays 0.00 and one audit row is still written',
  consequence: 'the audit entry is what makes a rebase reconstructible later; making it conditional on movement would lose the record of the link itself, which is the event a person would be looking for',
  parity: 'match',

  command: {
    verb: 'link_bank_account_snap',
    payload: { account_id: EVERYDAY, user_id: USER, bank_balance: '-25.00' },
  },
  expect: { outcome: 'ok' },
  result: { balance: '-25.00', initial_balance: '0.00' },
  state: [
    storedBalances(EVERYDAY, '-25.00/0.00'),
    {
      name: 'audited_anyway',
      sqlite: `SELECT COUNT(*) || '/' || COALESCE(MIN(action), '-') || '/'
                 || SUM(before_data IS NOT NULL) || '/' || SUM(after_data IS NOT NULL)
                 FROM financial_audit_log WHERE user_id = '${USER}'`,
      postgres: `SELECT COUNT(*) || '/' || COALESCE(MIN(action), '-') || '/'
                   || COUNT(*) FILTER (WHERE before_data IS NOT NULL) || '/'
                   || COUNT(*) FILTER (WHERE after_data IS NOT NULL)
                   FROM public.financial_audit_log WHERE user_id = '${USER}'`,
      expect: '1/update/1/1',
    },
  ],
};
