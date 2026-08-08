import {
  USER, EVERYDAY, RAINY_DAY,
  balanceOf, balanceIdentityHolds, auditRowsForCreate,
} from './_shared.mjs';

const NEW_ROW = '70000000-0000-0000-0000-0000000000a3';

// READ THIS ONE BEFORE PORTING ANY OTHER VERB.
//
// The instruction that produced this spec was "reproduce the transfer-category
// and provenance interactions the RPC performs — read its body, do not assume".
// Reading the body: THERE ARE NONE. `create_transaction_atomic` inserts
// `transfer_account_id` and `category` exactly as sent and does nothing else.
//
//   * T-6 ("each side files under the OTHER account's To/From category") lives
//     in `transfer_category_for` / `create_transfer_counterpart`,
//     20260716100000:43-61 and :121-137 — a different verb.
//   * T-1/T-3/T-7 (opposite amounts, not already linked, mutual link) live in
//     `link_transfer_pair`, 20260716100000:102-118.
//
// So a `type = 'transfer'` row created by this verb is a half-transfer with no
// counterpart, no link and no transfer category — and that is CORRECT. A port
// that "helpfully" filed the To/From category here would produce transfer
// reporting the cloud does not produce, and the harness would never catch it,
// because nothing else asserts the absence.
export default {
  invariant: 'T-6',
  title: 'a transfer-typed row is stored as sent: no counterpart, no link, no To/From category',
  design: 'the live RPC body, 20260808100000:126-160 — it inserts transfer_account_id and category verbatim',
  consequence: 'a port that resolved the transfer category here would move transfer reporting away from the cloud, silently, in the one verb everything else is built on',
  parity: 'match',

  command: {
    verb: 'create_transaction',
    payload: {
      id: NEW_ROW,
      user_id: USER,
      account_id: EVERYDAY,
      description: 'Standing order to savings',
      amount: '-100.00',
      type: 'transfer',
      date: '2024-03-02',
      transfer_account_id: RAINY_DAY,
    },
  },

  expect: { outcome: 'ok' },
  result: {
    type: 'transfer',
    amount: '-100.00',
    transfer_account_id: RAINY_DAY,
    linked_transfer_id: null,
    linked_transfer_split_id: null,
    category: null,
    category_id: null,
  },

  state: [
    balanceOf(EVERYDAY, '-125.00'),
    // The other side did NOT move. This verb creates one leg.
    balanceOf(RAINY_DAY, '0.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditRowsForCreate(NEW_ROW, '1'),
    {
      name: 'rows_filed_under_a_transfer_category',
      sqlite: `SELECT COUNT(*) FROM transactions t
                 JOIN categories c ON c.id = t.category
                WHERE t.id = '${NEW_ROW}' AND c.is_transfer_category = 1`,
      postgres: `SELECT COUNT(*) FROM public.transactions t
                   JOIN public.categories c ON c.id::text = t.category
                  WHERE t.id = '${NEW_ROW}' AND c.is_transfer_category`,
      expect: '0',
    },
    {
      name: 'counterpart_rows_created',
      sqlite: `SELECT COUNT(*) FROM transactions WHERE account_id = '${RAINY_DAY}'`,
      postgres: `SELECT COUNT(*) FROM public.transactions WHERE account_id = '${RAINY_DAY}'`,
      expect: '0',
    },
  ],
};
