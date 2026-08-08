import { USER, wiped } from './_shared.mjs';

export default {
  invariant: 'X-7',
  title: 'a chunk whose rows are an object rather than an array is refused',
  design: '20260807083000:251-254 — jsonb_typeof(p_rows) <> \'array\'',
  consequence: 'a client that sends one row instead of a list of one would otherwise be answered with a type error from deep inside the insert',
  parity: 'match',

  setup: wiped,
  command: {
    verb: 'restore_user_chunk',
    payload: { chunks: [{ entity: 'accounts', rows: {} }], user_id: USER },
  },
  expect: { outcome: 'refused', error: 'rows_not_an_array' },
};
