import { USER, EVERYDAY, RAINY_DAY, OTHER_LEG, THIS_LEG, PAIR_IN, transferPair, pairableRows,
  setups, balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  linkedRows, auditRowsInTotal } from './_shared.mjs';

// T-3. The last of the seven, and the one that keeps a movement of money from
// being claimed by two pairs at once. Here the −15.00 row is already linked to
// its own +15.00 counterpart; aiming it at a second +15.00 row would leave the
// original counterpart pointing at a row that now points somewhere else — a
// one-sided transfer made out of a good one.
//
// The +15.00 in Rainy day is the fixture pair's own side, so both rows named are
// linked; the refusal covers either.
export default {
  invariant: 'T-3',
  title: 'a row that is already half a linked transfer cannot be linked again',
  design: 'link_transfer_pair 20260716100000:116-118',
  consequence: 'one movement of money is claimed by two pairs and one of the four rows is stranded pointing at a row that has moved on',
  parity: 'match',

  setup: setups(transferPair, {
    sqlite: `${pairableRows.sqlite}
      UPDATE transactions SET amount_minor = 1500 WHERE id = '${PAIR_IN}';
      UPDATE accounts SET balance_minor = balance_minor - 1500 WHERE id = '${RAINY_DAY}';`,
    postgres: `${pairableRows.postgres}
      UPDATE public.transactions SET amount = 15.00 WHERE id = '${PAIR_IN}';
      UPDATE public.accounts SET balance = balance - 15.00 WHERE id = '${RAINY_DAY}';`,
  }),
  command: { verb: 'link_transfer_pair', payload: { id_a: OTHER_LEG, id_b: PAIR_IN, user_id: USER } },
  expect: { outcome: 'refused', error: 'transaction is already part of a linked transfer' },

  state: [
    transferShape(OTHER_LEG, `transfer:-:0002:${THIS_LEG.slice(-4)}:-`),
    transferShape(THIS_LEG, `transfer:-:0001:${OTHER_LEG.slice(-4)}:-`),
    transferShape(PAIR_IN, 'income:-:-:-:-'),
    transferLinksAreMutual(),
    linkedRows('2'),
    balanceOf(EVERYDAY, '-70.00'),
    balanceOf(RAINY_DAY, '30.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
