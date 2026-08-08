import { USER, wiped } from './_shared.mjs';

export default {
  invariant: 'X-1',
  title: 'a login with nothing in it answers yes',
  design: '20260807083000:107-130 — the precondition restore_user_chunk enforces, exposed so the UI can say so BEFORE the user picks a file',
  consequence: 'a user who is told to clear their login and then still cannot restore has been sent round a loop with no exit',
  parity: 'match',

  setup: wiped,
  command: { verb: 'user_financial_data_is_empty', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: { empty: true },
};
