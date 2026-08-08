import { USER, wiped } from './_shared.mjs';

export default {
  invariant: 'X-7',
  title: 'a JSON null for rows is refused, where an absent key is not',
  design: '20260807083000:251-254. jsonb_typeof(\'null\'::jsonb) is the text \'null\', which is not \'array\'. MEASURED',
  consequence: 'this is the case its sibling spec is contrasted against; the two together are what makes the hole in that guard visible rather than theoretical',
  parity: 'match',

  setup: wiped,
  command: {
    verb: 'restore_user_chunk',
    payload: { chunks: [{ entity: 'accounts', rows: null }], user_id: USER },
  },
  expect: { outcome: 'refused', error: 'rows_not_an_array' },
};
