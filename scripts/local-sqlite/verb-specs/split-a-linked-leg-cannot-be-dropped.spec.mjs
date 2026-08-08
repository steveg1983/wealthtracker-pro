import {
  USER, EVERYDAY, RAINY_DAY, CORNER_SHOP, WEEKLY_SHOP, LEG_LINE, PLAIN_LINE, LEG_COUNTERPART,
  setups, namedTransferCategories, splitWithTransferLeg,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, legPairsAreMutual,
  auditShape, rowExists, splitLineState,
} from './_shared.mjs';

// REFUSAL 6 of 20 — S-10, the one refusal the whole "match by identity" design
// exists to make POSSIBLE to state.
//
// The old writer replaced the line set wholesale, so it could not tell "line 2
// was re-categorised" from "line 1, which was a leg, was deleted". Unable to
// tell, it refused everything — and 78 split parents in production, 33 of them
// still carrying a line that needed filing, became uneditable. This is the
// refusal that remains once the writer can tell the difference, and it is
// narrow: drop a leg and you are refused, touch anything else in the same split
// and you are not.
//
// The refusal NAMES THE ACCOUNT, and that is load-bearing rather than polish:
// the remedy is to go and delete a transaction in another account, and a message
// that does not say which account is a message that cannot be acted on. Both
// engines produce "Rainy day" here, from the same COALESCE-to-'another account'
// lookup.
//
// R-5 is the sequel. The remedy this message gives — delete that transfer —
// would itself have been refused locally without the delete verb's leg guard,
// and `r5-the-delete-verb-clears-a-split-leg-instead-of-refusing.spec.mjs` is
// the proof that the dead end is closed.
export default {
  invariant: 'S-10',
  title: 'a line that is one half of a transfer cannot be dropped, and the refusal names the account',
  design: 'set_transaction_splits_with_legs 20260806094058:203-216 — named before anything is written, so the refusal costs nothing',
  consequence: 'the counterpart is left pointing at a line that no longer exists: the one-sided transfer this whole feature was built to prevent',
  parity: 'match',

  setup: setups(namedTransferCategories, splitWithTransferLeg),

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      // The leg's id is simply not here. Everything else is perfectly valid.
      splits: [
        { id: PLAIN_LINE, category: WEEKLY_SHOP, amount: '-15.00' },
        { category: WEEKLY_SHOP, amount: '-10.00' },
      ],
    },
  },

  // The expectation names the ACCOUNT rather than the refusal code, and that is
  // not decoration. `trg_protect_linked_leg_delete` in schema.sql raises
  // `split_leg_line_removed` too, so a local edition whose VERB had lost this
  // check would still refuse — from the file, one statement later, with a
  // generic message that does not say which account. MEASURED by deleting the
  // verb's own check: the spec passed on the code and failed on the name. Only
  // the verb's version can say "Rainy day", so only the name proves the verb ran.
  expect: { outcome: 'refused', error: 'transferring to "Rainy day"' },

  state: [
    // Nothing was deleted — the refusal is raised before the DELETE, which is
    // also why the local edition needs no leg guard here.
    splitLines(
      CORNER_SHOP,
      '0:-15.00:To/From Rainy day:0002:linked:- | 1:-10.00:Weekly shop:-:-:-',
    ),
    splitLineState(LEG_LINE, 'linked'),
    rowExists(LEG_COUNTERPART, '1'),
    legPairsAreMutual(),
    splitSumHolds(CORNER_SHOP),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditShape('NONE'),
  ],
};
