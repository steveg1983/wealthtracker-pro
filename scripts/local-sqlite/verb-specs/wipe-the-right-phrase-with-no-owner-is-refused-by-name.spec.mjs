export default {
  invariant: 'X-2',
  title: 'the right phrase and no owner is refused for the owner',
  design: '20260807083000:162-166. In the cloud the owner falls back to requesting_user_id(); in a local file there is no session to ask, so the argument is the only source and its absence is the same refusal',
  consequence: 'a wipe that could not establish whose data it was clearing would clear somebody\'s',
  parity: 'match',

  command: { verb: 'wipe_user_financial_data', payload: { confirm: 'DELETE EVERYTHING' } },
  expect: { outcome: 'refused', error: 'owner_unknown' },
};
