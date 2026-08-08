import { USER, RESTORED_ROW, backupTransaction, chunk, wipedWithOneAccount } from './_shared.mjs';

export default {
  invariant: 'R-11',
  title: 'a restored transaction arrives unlinked, whatever the file said',
  design: '20260807083000:288-289 nulls linked_transfer_id and linked_transfer_split_id on the way in, because their constraints form cycles and none is DEFERRABLE in the cloud. finalize_user_restore puts them back',
  consequence: 'without the deferral neither side of the cycle can be inserted first, so the restore would refuse the first transfer it met',
  parity: 'match',

  setup: wipedWithOneAccount,
  command: {
    verb: 'restore_user_chunk',
    payload: {
      chunks: [chunk('transactions', [backupTransaction({
        linked_transfer_id: '70000000-0000-0000-0000-0000000000f2',
        linked_transfer_split_id: '50000000-0000-0000-0000-0000000000f2',
      })])],
      user_id: USER,
    },
  },
  expect: { outcome: 'ok' },
  result: { inserted: 1 },
  state: [
    {
      name: 'links_on_arrival',
      sqlite: `SELECT COALESCE(linked_transfer_id, 'DEFERRED') || '/'
                 || COALESCE(linked_transfer_split_id, 'DEFERRED')
                 FROM transactions WHERE id = '${RESTORED_ROW}'`,
      postgres: `SELECT COALESCE(linked_transfer_id::text, 'DEFERRED') || '/'
                   || COALESCE(linked_transfer_split_id::text, 'DEFERRED')
                   FROM public.transactions WHERE id = '${RESTORED_ROW}'`,
      expect: 'DEFERRED/DEFERRED',
    },
  ],
};
