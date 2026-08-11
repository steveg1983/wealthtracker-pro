import {
  USER, EVERYDAY, RAINY_DAY, WEEKLY_SHOP, OTHER_LEG, THIS_LEG,
  balanceOf, balanceIdentityHolds, transferPair, transferShape,
} from './_shared.mjs';

// Deliberately not an error, and the reason is the case it exists for: after the
// SOURCE's own account has been changed, the counterpart is already in the right
// place and is filed under the To/From category of an account this transfer has
// nothing to do with any more. Sending the unchanged target re-files both sides
// and moves nothing.
//
// The setup mis-files the counterpart first, so the assertion is that a stale
// category was CORRECTED rather than that it happened to be right already.
export default {
  invariant: 'T-6',
  title: 'a re-point at the account the counterpart is already in re-files it and moves no money',
  design: 'repoint_transfer 20260810140000:76-84 — "safe to call with an unchanged target", which is what makes it the right call after the source moved',
  consequence: 'a leg left filed under a stale To/From category reports the transfer against an account it no longer touches',
  parity: 'match',

  setup: {
    sqlite: `UPDATE transactions SET category = '${WEEKLY_SHOP}' WHERE id = '${THIS_LEG}';
${transferPair.sqlite}`,
    postgres: `${transferPair.postgres}
    UPDATE public.transactions SET category = '${WEEKLY_SHOP}' WHERE id = '${THIS_LEG}';`,
  },
  command: {
    verb: 'repoint_transfer',
    payload: { id: OTHER_LEG, target_account_id: RAINY_DAY, user_id: USER },
  },
  expect: { outcome: 'ok' },

  // A To/From category's id is minted by a trigger on BOTH engines and is
  // unknowable at authoring time on either, so the projected row cannot be
  // compared on it. The state assertions compare it by NAME instead, which is
  // the half that carries the crossover rule.
  rowDivergence: {
    category: 'a To/From category\'s id is minted by a trigger on both engines and is unknowable at authoring time on either — the state assertions compare it by NAME instead',
  },

  state: [
    transferShape(OTHER_LEG, 'transfer:To/From Rainy day:0002:0005:-'),
    transferShape(THIS_LEG, 'transfer:To/From Everyday:0001:0004:-'),
    // Not a penny moved.
    balanceOf(EVERYDAY, '-40.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
  ],
};
