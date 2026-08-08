import { USER, everyShapeOfFiling, filingBoard, auditShape } from './_shared.mjs';

// The floor case, and the reason the argument is `Option<Vec<…>>` rather than
// `Vec<…>`: the RPC accepts a NULL array and returns zero, and a deserialiser
// that refused `null` would turn a legitimate call into `invalid_command` on one
// engine only.
export default {
  invariant: 'TS-M3',
  title: 'an empty list confirms nothing and is not an error',
  design: 'confirm_transaction_categories 20260808100000:453-455 — id = ANY(p_ids) over an empty array',
  consequence: 'the confirm-all button raises an error when nothing is selected',
  parity: 'match',

  setup: everyShapeOfFiling,
  command: { verb: 'confirm_transaction_categories', payload: { ids: [], user_id: USER } },
  expect: { outcome: 'ok' },

  state: [
    filingBoard('Blank=EMPTY/guess | Null=NULL/guess | Spaces=EMPTY/guess | Filed=Weekly shop/vouched | Guessed=Weekly shop/guess'),
    auditShape('NONE'),
  ],
};
