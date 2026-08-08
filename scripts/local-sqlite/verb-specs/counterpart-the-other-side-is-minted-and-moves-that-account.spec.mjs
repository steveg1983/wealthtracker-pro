import { USER, EVERYDAY, RAINY_DAY, CORNER_SHOP,
  balanceOf, balanceIdentityHolds, rowsIn, transferShape, transferLinksAreMutual,
  linkedRows, auditShape } from './_shared.mjs';

// THE CENTRAL BEHAVIOUR OF THIS VERB, and the one place in the transfer family
// where money moves. Every part of it is asserted:
//
//   * a row is minted in the target account for the exact NEGATION of the
//     source: −25.00 out of Everyday becomes +25.00 into Rainy day;
//   * it files under the SOURCE account's To/From category (T-6) — it sits in
//     Rainy day and reads "To/From Everyday". Backwards is plausible and wrong;
//   * it carries the source's description, date and notes, and is NOT cleared:
//     a statement you have reconciled says nothing about one in another bank.
//     `uncleared` in the row projection is that assertion;
//   * the pair is mutual (T-7): the source names the new row and the new row
//     names the source;
//   * Rainy day moves by exactly the counterpart's amount and Everyday does not
//     move at all — the source row's amount is unchanged, so there is nothing to
//     move it by. Net worth is the same, which is what makes it a transfer;
//   * three audit entries for one call: the row minted, the row that changed,
//     and the account whose balance moved. `account/update` appearing here — and
//     NOT in any other verb of this family — is the audit log itself testifying
//     which of the four moves money.
export default {
  invariant: 'B-2',
  title: 'the other side is minted in the target account, filed backwards on purpose, and moves that balance',
  design: 'create_transfer_counterpart 20260721090000:76-108 — INSERT, UPDATE, balance = balance + amount, three audit rows',
  consequence: 'the Money answer for a one-sided import — "make the other half" — cannot be said, and the pre-feed history that only ever had one side stays uncorrectable',
  parity: 'match',

  command: {
    verb: 'create_transfer_counterpart',
    payload: { id: CORNER_SHOP, target_account_id: RAINY_DAY, user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { id: CORNER_SHOP, amount: '-25.00', type: 'transfer' },

  rowDivergence: {
    category: 'a To/From category\'s id is minted by a trigger on both engines and is unknowable at authoring time on either — the state assertions compare it by NAME instead',
    linked_transfer_id: 'the counterpart is minted DURING the call, so its uuid differs per engine and always will — the state assertions compare the FACT of the link instead',
  },

  state: [
    transferShape(CORNER_SHOP, 'transfer:To/From Rainy day:0002:linked:-', { namesIds: false }),
    rowsIn(RAINY_DAY, '25.00:transfer:To/From Everyday:Corner shop:-:uncleared:linked'),
    transferLinksAreMutual(),
    linkedRows('2'),
    balanceOf(EVERYDAY, '-25.00'),
    balanceOf(RAINY_DAY, '25.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditShape('account/update,transaction/create,transaction/update'),
  ],
};
