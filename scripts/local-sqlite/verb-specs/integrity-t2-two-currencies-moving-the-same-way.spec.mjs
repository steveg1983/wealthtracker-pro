import { OTHER_LEG, THIS_LEG, linkedSidesInTwoCurrencies } from './_shared.mjs';

// T-2 keeps its teeth across the boundary: it gave up magnitude, not direction.
//
// Both sides here fall. Whatever the rate was, that is not one movement seen
// from two ends — it is two spends wearing a link, and the two accounts between
// them really did lose money that the ledger says went from one to the other.
//
// Reported on BOTH rows, for the reason the same-currency spec gives: the check
// reads every row that names another, and naming one would leave the other
// looking innocent. The detail differs from the same-currency wording because
// the complaint differs — "not exact opposites" would send a reader to compare
// the magnitudes, which is precisely what this rule no longer cares about.
export default {
  invariant: 'T-2',
  title: 'a linked pair in two currencies that both move the same way — reported on BOTH rows',
  design: 'schema.sql transfer_amounts_not_opposite — (a.amount_minor > 0) = (b.amount_minor > 0) across a currency boundary',
  consequence: 'two separate spends are recorded as one movement, and because each account is individually consistent with its own rows, nothing else in the product can notice',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  setup: linkedSidesInTwoCurrencies({ minor: -3800 }),
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: {
    ok: false,
    violations: 2,
    warnings: 0,
    findings: [
      {
        check: 'transfer_amounts_not_opposite',
        entity: 'transaction',
        id: OTHER_LEG,
        severity: 'violation',
        detail: 'linked transfer sides in different currencies both move the same way',
      },
      {
        check: 'transfer_amounts_not_opposite',
        entity: 'transaction',
        id: THIS_LEG,
        severity: 'violation',
        detail: 'linked transfer sides in different currencies both move the same way',
      },
    ],
  },
};
