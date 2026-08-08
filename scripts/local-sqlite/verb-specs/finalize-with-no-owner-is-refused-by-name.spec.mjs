export default {
  invariant: 'X-6',
  title: 'a finalize that cannot say which login it is for is refused',
  design: '20260807083000:397-401',
  consequence: 'the second pass writes into whichever rows the links name; with no owner it would write into anybody\'s',
  parity: 'match',

  command: { verb: 'finalize_user_restore', payload: { links: {} } },
  expect: { outcome: 'refused', error: 'owner_unknown' },
};
