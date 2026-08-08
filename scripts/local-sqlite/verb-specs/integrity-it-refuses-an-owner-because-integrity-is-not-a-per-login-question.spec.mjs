import { USER, secondUser } from './_shared.mjs';

export default {
  invariant: 'V',
  title: 'naming an owner is refused, not ignored',
  design: 'The command struct is empty and carries deny_unknown_fields. Every other verb in the crate is scoped to a login; this one is a question about the FILE',
  consequence: 'three of the seventeen checks have no per-user reading at all — the audit chain is one sequence for the whole file — so an owner argument would have to be silently ignored by a third of them. A caller who passed one and got a filtered answer for some checks and an unfiltered one for others would have no way to know which was which',
  parity: 'not-comparable',
  reason: 'verify_integrity is local-only — see the verb module for the trace',
  skip: { postgres: 'there is no cloud counterpart to compare against' },

  // The second login is here to make the refusal mean something: this file
  // genuinely holds another login's rows, and one of them is a violation
  // (C-3, its account has no To/From category). A scoped verb would have hidden
  // it. The refusal is what says the scoping does not exist rather than that it
  // was not asked for.
  setup: secondUser,
  command: { verb: 'verify_integrity', payload: { user_id: USER } },
  expect: { outcome: 'refused', error: 'unknown_field' },
};
