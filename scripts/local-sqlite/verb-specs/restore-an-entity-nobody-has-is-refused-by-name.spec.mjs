import { USER, chunk, wiped } from './_shared.mjs';

export default {
  invariant: 'X-7',
  title: 'a table nobody has, with a row in it, is refused by name',
  design: '20260807083000:366-368. p_entity is matched against a fixed list; there is no dynamic SQL on either engine',
  consequence: 'a backup written by a newer version of the app, carrying a table this one does not have, must say so rather than dropping the rows',
  parity: 'match',

  setup: wiped,
  command: {
    verb: 'restore_user_chunk',
    payload: { chunks: [chunk('not_a_table', [{ id: 'x' }])], user_id: USER },
  },
  expect: { outcome: 'refused', error: 'restore_entity_unknown' },
};
