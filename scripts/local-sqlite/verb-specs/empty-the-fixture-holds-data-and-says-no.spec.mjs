import { USER } from './_shared.mjs';

export default {
  invariant: 'X-1',
  title: 'a login holding anything at all answers no',
  design: '20260807083000:107-130',
  consequence: 'restoring on top of a live login would mix two datasets and silently re-date the history of one of them',
  parity: 'match',

  command: { verb: 'user_financial_data_is_empty', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: { empty: false },
};
