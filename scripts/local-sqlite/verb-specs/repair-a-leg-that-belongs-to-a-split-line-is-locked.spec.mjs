import { EVERYDAY, RAINY_DAY, LEG_LINE, balanceOf, balanceIdentityHolds, transferShape,
  transferLinksAreMutual, auditRowsInTotal } from './_shared.mjs';
import { claimedTransfer, repairPayload, STRANDED, PARTNER, COUNTERPART } from './_repair.mjs';

// The repair rewrites `linked_transfer_id` on all three rows. A row whose link
// belongs to a split LINE has a second pointer — `linked_transfer_split_id` —
// that this verb does not touch, so re-pointing it would leave the line pointing
// at a row that now points somewhere else. Same reasoning as T-12's skip in
// `clear_transfer_links`, expressed here as a refusal because a repair cannot
// usefully "skip" one of its three rows.
//
// MEASURED to sit below the split check and above the archive check
// (probe-transfers3.sh, `rct-split-beats-legsplit`, `rct-legsplit-beats-archived`).
export default {
  invariant: 'T-12',
  title: 'a row that is the other side of a split line cannot be re-paired',
  design: 'repair_claimed_transfer 20260805145035:338-343',
  consequence: 'a split line is left pointing at a row that has been re-pointed elsewhere, and the split becomes uneditable',
  parity: 'match',

  setup: {
    // The stranded row is made to look like a split leg's counterpart by giving
    // it a linked_transfer_split_id — the one column this repair must not
    // disturb. The line it names is created unlinked, so nothing else changes.
    sqlite: `${claimedTransfer.sqlite}
      INSERT INTO _rpc_guard VALUES ('split');
      UPDATE transactions SET is_split = 1, category = ''
       WHERE id = '70000000-0000-0000-0000-000000000001';
      INSERT INTO transaction_splits (id, transaction_id, user_id, category, amount_minor, sort_order) VALUES
        ('${LEG_LINE}', '70000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
         'c0000000-0000-0000-0000-000000000003', -1500, 1),
        ('50000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001',
         '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000003', -1000, 2);
      DELETE FROM _rpc_guard;
      UPDATE transactions SET linked_transfer_split_id = '${LEG_LINE}' WHERE id = '${STRANDED}';`,
    postgres: `${claimedTransfer.postgres}
      SELECT set_config('app.split_rpc', '1', true);
      UPDATE public.transactions SET is_split = true, category = ''
       WHERE id = '70000000-0000-0000-0000-000000000001';
      INSERT INTO public.transaction_splits (id, transaction_id, user_id, category, amount, sort_order) VALUES
        ('${LEG_LINE}', '70000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
         'c0000000-0000-0000-0000-000000000003', -15.00, 1),
        ('50000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001',
         '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000003', -10.00, 2);
      SELECT set_config('app.split_rpc', '0', true);
      UPDATE public.transactions SET linked_transfer_split_id = '${LEG_LINE}' WHERE id = '${STRANDED}';`,
  },
  command: { verb: 'repair_claimed_transfer', payload: repairPayload() },
  expect: { outcome: 'refused', error: 'transfer_leg_locked_by_split_line' },

  state: [
    transferShape(STRANDED, `expense:-:-:-:${LEG_LINE.slice(-4)}`),
    transferShape(PARTNER, `transfer:-:0002:${COUNTERPART.slice(-4)}:-`),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '-55.00'),
    balanceOf(RAINY_DAY, '15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsInTotal('0'),
  ],
};
