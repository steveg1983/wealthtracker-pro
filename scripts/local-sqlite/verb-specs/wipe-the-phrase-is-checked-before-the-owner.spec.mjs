export default {
  invariant: 'X-2',
  title: 'no phrase and no owner is told about the phrase, which is the half they can fix',
  design: '20260807083000:157-166 — the confirmation test is the first statement in the function and the owner is resolved after it. MEASURED, all four pairs, on the reference cluster',
  consequence: 'told about an identity problem instead, a user retypes their password; told about the phrase, they type the phrase',
  parity: 'match',

  command: { verb: 'wipe_user_financial_data', payload: { confirm: 'nope' } },
  expect: { outcome: 'refused', error: 'wipe_not_confirmed' },
};
