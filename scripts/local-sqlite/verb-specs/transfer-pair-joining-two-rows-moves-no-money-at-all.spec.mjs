import { USER, EVERYDAY, RAINY_DAY, PAIR_OUT, PAIR_IN, pairableRows,
  balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  linkedRows, auditShape, rowsIn } from './_shared.mjs';

// THE CENTRAL BEHAVIOUR OF THIS VERB, and the property that separates it from
// its sibling: `link_transfer_pair` is balance-neutral BY CONSTRUCTION. Both
// rows already exist and already count against their accounts; joining them
// tells the ledger they are one movement and changes no figure anywhere.
//
// Everything the join does IS asserted, because "changes no figure" is only
// half the contract:
//
//   * both rows become type `transfer`;
//   * each files under the OTHER account's To/From category (T-6) — the −30.00
//     row, which sits in Everyday, reads "To/From Rainy day". Filing each side
//     under its own account's category reads plausibly in a register and is
//     backwards, which is why this is asserted by NAME on both sides;
//   * each names the other's account and the other's row, mutually (T-7);
//   * the pre-existing filing (Weekly shop) is overwritten — a transfer is not
//     spending and must stop counting as it;
//   * both balances stand still, and B-1 holds on both;
//   * two audit rows, one per row touched, and no `account/update` at all —
//     which is how the audit log itself testifies that no balance moved.
export default {
  invariant: 'T-6',
  title: 'joining two existing rows types them, files each under the other account, and moves nothing',
  design: 'link_transfer_pair 20260716100000:121-143 — two UPDATEs, two audit rows, no accounts statement',
  consequence: 'the Money answer — "these two rows are one movement" — cannot be said, and every transfer is double-counted as spending on one side and income on the other',
  parity: 'match',

  setup: pairableRows,
  command: { verb: 'link_transfer_pair', payload: { id_a: PAIR_OUT, id_b: PAIR_IN, user_id: USER } },
  expect: { outcome: 'ok' },
  result: { id: PAIR_OUT, amount: '-30.00', type: 'transfer' },

  rowDivergence: {
    category: 'a To/From category\'s id is minted by a trigger on both engines and is unknowable at authoring time on either — the state assertions compare it by NAME instead',
  },

  state: [
    transferShape(PAIR_OUT, `transfer:To/From Rainy day:0002:${PAIR_IN.slice(-4)}:-`),
    transferShape(PAIR_IN, `transfer:To/From Everyday:0001:${PAIR_OUT.slice(-4)}:-`),
    transferLinksAreMutual(),
    linkedRows('2'),
    rowsIn(RAINY_DAY, '30.00:transfer:To/From Everyday:Moved in:-:uncleared:linked'),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(RAINY_DAY, '30.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditShape('transaction/update,transaction/update'),
  ],
};
