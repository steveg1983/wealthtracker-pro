import { CARD, anAvailableBalanceStoredAsABankBalance } from './_shared.mjs';

export default {
  invariant: 'INGEST-2',
  title: 'remaining credit stored where the bank\'s own figure belongs',
  design: "PHASE1-PLAN §2.5's second addendum check, bank_balance_implausible. <AVAILBAL> is remaining credit — positive, and larger than the <LEDGERBAL> it gets mistaken for (TS-I1/TS-I2)",
  consequence: 'bank_balance is what reconciliation compares against. Fill it with available credit and the account is permanently, hugely out — and the user is invited to "fix" a ledger that was right by adjusting it to a number that was never a balance',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  setup: anAvailableBalanceStoredAsABankBalance,
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: {
    ok: true,
    violations: 0,
    warnings: 1,
    findings: [{
      check: 'bank_balance_implausible',
      entity: 'account',
      id: CARD,
      severity: 'warning',
      detail: 'the bank figure disagrees with the ledger by more than the ledger itself — an available balance may have been stored as a bank balance',
    }],
  },
};
