import { USER, chunk } from './_shared.mjs';

export default {
  invariant: 'X-7',
  title: 'an empty chunk of a table nobody has is accepted in silence',
  design: '20260807083000:256-258 returns before the ELSIF ladder is reached. MEASURED: p_entity = "not_a_table" with [] returns 0 and raises nothing',
  consequence: 'a surprise worth pinning rather than tidying: a client that invents an entity name is told nothing as long as it sends no rows, so the whitelist is not a spelling check',
  parity: 'match',

  command: {
    verb: 'restore_user_chunk',
    payload: { chunks: [chunk('not_a_table', [])], user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { inserted: 0 },
};
