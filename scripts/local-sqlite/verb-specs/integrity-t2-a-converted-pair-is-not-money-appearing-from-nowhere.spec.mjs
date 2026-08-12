import { linkedSidesInTwoCurrencies } from './_shared.mjs';

// The other half of the 2026-08-12 change, and the half that is easy to forget.
//
// Loosening the VERB without loosening the CHECK would have been worse than
// leaving both alone: every pair the new dialog created would have been written
// happily and then reported by verify_integrity as "linked transfer sides are
// not exact opposites" — money appearing from nowhere — for the rest of the
// file's life. The owner's ledger already holds 70 importer-written pairs that
// would have been flagged the first time anybody ran it.
//
// So T-2 now asks the same question the verb asks: same currency, exact
// opposites; different currencies, opposite in sign. This spec is the proof it
// asks it, and it uses a pair whose magnitudes are genuinely unequal — the only
// shape that can tell the old check from the new one.
//
// The refusal side of the same rule is covered by
// `integrity-t2-two-sides-that-do-not-cancel` (same currency, still strict) and
// `integrity-t2-two-currencies-moving-the-same-way` (the direction rule).
export default {
  invariant: 'T-2',
  title: 'a linked pair in two currencies at a real rate is not a violation',
  design: 'schema.sql transfer_amounts_not_opposite — the CASE on currency, matching link_transfer_pair 20260812100000',
  consequence: 'every legitimately converted transfer in the file is reported as money appearing from nowhere, so the integrity report becomes noise and the real violations in it stop being read',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  setup: linkedSidesInTwoCurrencies({ minor: 3800 }),
  command: { verb: 'verify_integrity', payload: {} },
  expect: { outcome: 'ok' },
  result: {
    ok: true,
    violations: 0,
    warnings: 0,
    findings: [],
  },
};
