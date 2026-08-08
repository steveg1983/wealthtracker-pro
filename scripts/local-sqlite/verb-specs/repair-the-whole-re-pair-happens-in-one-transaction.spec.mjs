import { EVERYDAY, RAINY_DAY, balanceOf, balanceIdentityHolds, transferShape,
  transferLinksAreMutual, linkedRows, auditShape, auditRowsForUpdate, rowsIn } from './_shared.mjs';
import { claimedTransfer, repairPayload, STRANDED, PARTNER, COUNTERPART } from './_repair.mjs';

// THE CENTRAL BEHAVIOUR OF THIS VERB: three changes that must all happen or
// none, and every one of them is asserted here.
//
//   1. the wrong pairing is broken on BOTH sides — a half-broken pair IS a
//      one-sided transfer, the exact thing this feature exists to prevent;
//   2. the displaced row is filed as Account Adjustment and loses its transfer
//      scaffolding: no target, no link, and its TYPE re-derived from the sign of
//      its own amount (−15.00 → expense). It is a revaluation now — neither
//      income nor spending — so the correction cannot strand a row in its turn;
//   3. the counterpart is re-pointed at the row that really matches it, each
//      side filing under the OTHER account's To/From category (T-6).
//
// And the two properties that make it evidence rather than a change:
//
//   * T-14 — each of the three rows is written EXACTLY ONCE, so each audit
//     entry's `before` is what the user was looking at when they pressed the
//     button. Three `transaction/update` rows, no more: the link step is spelled
//     out here rather than calling link_transfer_pair precisely so that no entry
//     records a half-repaired intermediate state;
//   * balance-neutral by construction — no amount, sign or account_id is written
//     by any statement, so no `account/update` appears at all and both balances
//     stand exactly where they were.
export default {
  invariant: 'T-14',
  title: 'the whole re-pair — break, file, link — happens once, atomically, and moves no money',
  design: 'repair_claimed_transfer 20260805145035:397-442 — three UPDATEs, three audit rows, no accounts statement',
  consequence: 'the correction is three round trips with a hand-written compensation, and a browser closed halfway leaves the ledger in a state no single write intended',
  parity: 'match',

  setup: claimedTransfer,
  command: { verb: 'repair_claimed_transfer', payload: repairPayload() },
  expect: { outcome: 'ok' },
  result: { id: STRANDED, amount: '-15.00', type: 'transfer' },

  rowDivergence: {
    category: 'a To/From category\'s id is minted by a trigger on both engines and is unknowable at authoring time on either — the state assertions compare it by NAME instead',
  },

  state: [
    transferShape(STRANDED, `transfer:To/From Rainy day:0002:${COUNTERPART.slice(-4)}:-`),
    transferShape(COUNTERPART, `transfer:To/From Everyday:0001:${STRANDED.slice(-4)}:-`),
    // The displaced row: unlinked, untargeted, re-typed by its own sign, filed.
    transferShape(PARTNER, 'expense:Account Adjustment:-:-:-'),
    transferLinksAreMutual(),
    linkedRows('2'),
    rowsIn(RAINY_DAY, '15.00:transfer:To/From Everyday:From everyday:-:uncleared:linked'),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    // T-14: exactly one entry per row, and none for any account.
    auditShape('transaction/update,transaction/update,transaction/update'),
    auditRowsForUpdate(PARTNER, '1'),
    auditRowsForUpdate(COUNTERPART, '1'),
    auditRowsForUpdate(STRANDED, '1'),
  ],
};
