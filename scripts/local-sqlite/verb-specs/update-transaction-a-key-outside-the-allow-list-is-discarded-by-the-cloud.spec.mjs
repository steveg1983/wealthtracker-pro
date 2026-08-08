import {
  USER, EVERYDAY, CORNER_SHOP,
  enriched, balanceIdentityHolds, storedFlag,
} from './_shared.mjs';

// D-7, MADE EXECUTABLE. AUDIT3 §2 and §2.1 proposed this as a disagreement to
// record; this is it, asserted from both sides, which is the only form in which
// a disagreement stays true.
//
// `update_transaction_atomic` sets exactly fifteen columns and SILENTLY
// DISCARDS every other key. MEASURED, reference cluster, one call each:
// `archived`, `is_split`, `linked_transfer_id`, `statement_sequence`, `user_id`
// and the plain typo `amont` all return a row unchanged, with no error and no
// warning.
//
// The design behind the allow-list is good: those columns have dedicated verbs
// (`link_transfer_pair`, `set_transaction_archived`, `set_transactions_cleared`,
// the split writer) precisely so a general-purpose update surface cannot break
// mutual linkage (#31/T-7). The ENFORCEMENT is what is wrong — it is silence,
// and the file that added `is_cleared` to the list records the incident silence
// caused (20260707120000:5-11): a checkbox that "succeeded" without doing
// anything, for a month.
//
// The same silence hid the `is_cleared` regression in create_transaction_atomic
// for another month. Twice is a pattern, so the local edition breaks it: an
// unrecognised key is a REFUSAL.
//
// The divergence is one-directional and safe in the direction that matters. No
// caller that works today stops working — a caller sending a key outside the
// fifteen is, by construction, a caller whose intent is already not being
// carried out. It stops being told that it was.
export default {
  invariant: 'D-7',
  title: 'a key outside the fifteen is silently discarded by the cloud and refused by the local edition',
  design: 'update_transaction_atomic 20260808100000:305-334 — the SET list IS the allow-list, and nothing outside it is mentioned anywhere',
  consequence: 'silence here is how the reconciliation checkbox did nothing for a month (20260707120000:5-11) and how create_transaction_atomic lost is_cleared for another; a caller that misspells a field is told it succeeded',
  parity: 'divergent',
  reason: 'DECLARED. The cloud discards unknown keys; the local command struct carries deny_unknown_fields and refuses. Same allow-list, enforced out loud instead of by omission. Assert the difference rather than hide it — and note that the cloud side of this spec is what pins the discard, so the day the cloud starts refusing, this fails and the divergence is retired deliberately.',

  setup: enriched,

  command: {
    verb: 'update_transaction',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      patch: {
        description: 'A legal field, sent alongside an illegal one',
        // Not in the fifteen. Setting `archived` through this path would move a
        // row out of the live register; setting `linked_transfer_id` would
        // strand a transfer pair. Both have their own verbs, and both are
        // dropped on the floor here.
        archived: true,
      },
    },
  },

  expect: {
    // The cloud takes the description and ignores the rest, and says so by
    // saying nothing.
    postgres: { outcome: 'ok' },
    // The local edition takes neither. An edit is one instruction: if part of
    // it cannot be carried out, none of it is. The refusal is NAMED —
    // `unknown_field`, not a generic parse failure — because a divergence that
    // reports as "your request was malformed" is one the caller cannot act on.
    // That the message also names `archived` is asserted in the crate's own
    // tests, where the prose belongs.
    sqlite: { outcome: 'refused', error: 'unknown_field' },
  },

  state: [
    {
      // The point of the whole spec: `archived` is false on BOTH engines
      // afterwards. The cloud got there by ignoring the instruction, the local
      // edition by refusing it. The user's data is in the same state; only one
      // of them told the truth about how it got there.
      name: 'archived_after',
      sqlite: `SELECT CASE WHEN archived = 1 THEN 'yes' ELSE 'no' END
                 FROM transactions WHERE id = '${CORNER_SHOP}'`,
      postgres: `SELECT CASE WHEN archived THEN 'yes' ELSE 'no' END
                   FROM public.transactions WHERE id = '${CORNER_SHOP}'`,
      expect: 'no',
    },
    {
      name: 'description_after',
      sqlite: `SELECT description FROM transactions WHERE id = '${CORNER_SHOP}'`,
      postgres: `SELECT description FROM public.transactions WHERE id = '${CORNER_SHOP}'`,
      expect: {
        postgres: 'A legal field, sent alongside an illegal one',
        sqlite: 'Corner shop',
      },
    },
    storedFlag(CORNER_SHOP, 'is_cleared', 'yes'),
    balanceIdentityHolds(EVERYDAY),
  ],
};
