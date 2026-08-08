import { USER, wiped } from './_shared.mjs';

export default {
  invariant: 'X-7',
  title: 'a chunk with no rows key at all slips past the array guard and returns nothing',
  design: '20260807083000:251-254. An absent key reaches the RPC as SQL NULL; jsonb_typeof(NULL) is NULL, NULL <> \'array\' is NULL, and plpgsql treats NULL as false — so the guard is skipped. MEASURED, into an emptied login: 0, no refusal',
  consequence: 'a HOLE, ported rather than closed. Closing it locally would make the local edition refuse a call the cloud accepts, and a client that stopped sending a key would then fail on one engine only — which is worse than a call that quietly does nothing on both',
  parity: 'match',

  setup: wiped,
  command: {
    verb: 'restore_user_chunk',
    payload: { chunks: [{ entity: 'accounts' }], user_id: USER },
  },
  expect: { outcome: 'ok' },
  result: { inserted: 0 },
};
