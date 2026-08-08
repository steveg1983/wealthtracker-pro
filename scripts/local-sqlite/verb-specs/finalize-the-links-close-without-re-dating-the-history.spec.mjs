import { USER, OTHER_LEG, THIS_LEG, transferPair, updatedDay } from './_shared.mjs';

export default {
  invariant: 'X-4',
  title: 'the second pass relinks a decade-old transfer and leaves it dated when it happened',
  design: '20260807083000:87-99 redefines update_updated_at_column to stand down while app.restore_in_progress is set; schema.sql puts the same exemption in each updated_at trigger\'s WHEN clause as _rpc_guard(\'restore\'). MEASURED both ways on both engines: without the flag the row is dated today, with it the row keeps 2019',
  consequence: 'the migration says it in one line: a backup that returns a decade of transfers dated today is not a backup',
  parity: 'match',

  setup: {
    // The pair, unlinked and back-dated — the state the first pass leaves.
    sqlite: `${transferPair.sqlite}
      UPDATE transactions SET linked_transfer_id = NULL WHERE id IN ('${OTHER_LEG}', '${THIS_LEG}');
      UPDATE transactions SET updated_at = '2019-01-01T00:00:00.000Z'
       WHERE id IN ('${OTHER_LEG}', '${THIS_LEG}');`,
    postgres: `${transferPair.postgres}
      UPDATE public.transactions SET linked_transfer_id = NULL WHERE id IN ('${OTHER_LEG}', '${THIS_LEG}');
      SELECT set_config('app.restore_in_progress', '1', true);
      UPDATE public.transactions SET updated_at = '2019-01-01T00:00:00Z'
       WHERE id IN ('${OTHER_LEG}', '${THIS_LEG}');
      SELECT set_config('app.restore_in_progress', '0', true);`,
  },
  command: {
    verb: 'finalize_user_restore',
    payload: {
      links: {
        transaction_links: [
          { id: OTHER_LEG, linked_transfer_id: THIS_LEG, linked_transfer_split_id: null },
          { id: THIS_LEG, linked_transfer_id: OTHER_LEG, linked_transfer_split_id: null },
        ],
      },
      user_id: USER,
    },
  },
  expect: { outcome: 'ok' },
  result: { accounts_relinked: 0, transactions_relinked: 2 },
  state: [
    {
      name: 'the_pair_is_mutual_again',
      sqlite: `SELECT COUNT(*) FROM transactions a JOIN transactions b ON b.id = a.linked_transfer_id
                WHERE b.linked_transfer_id = a.id`,
      postgres: `SELECT COUNT(*) FROM public.transactions a JOIN public.transactions b ON b.id = a.linked_transfer_id
                  WHERE b.linked_transfer_id = a.id`,
      expect: '2',
    },
    updatedDay('transactions', OTHER_LEG, '2019-01-01'),
    updatedDay('transactions', THIS_LEG, '2019-01-01'),
  ],
};
