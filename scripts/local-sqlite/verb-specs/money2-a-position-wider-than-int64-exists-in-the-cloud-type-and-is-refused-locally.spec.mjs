import {
  USER, EVERYDAY, NEW_HOLDING,
  investmentShape, holdingsOwnedBy, balanceIdentityHolds,
} from './_shared.mjs';

// THE INT64 CLIFF, which `scripts/local-sqlite/schema.sql` names as *"deliberate
// and tested"* and which had no test until this slice.
//
// The schema's own arithmetic:
//
//   QTY = ±9e18 raw at 1e8 = ±90,000,000,000 units, 8dp exact.
//        Postgres numeric(20,8) permits 1e12 units, so a position larger than
//        9e10 units exists in the cloud type and is REFUSED here.
//
// A trillion units of anything is not a portfolio, and that is the point rather
// than an objection: the two type systems disagree about what is REPRESENTABLE,
// and a disagreement discovered by a restore — a cloud backup carrying a row the
// file cannot hold — is worse than one written down. The refusal is NAMED
// (`figure_out_of_range`) so a restore can say which row and why, instead of
// failing as an integer overflow inside a column CHECK.
export default {
  invariant: 'MONEY-2',
  title: 'a position larger than the file can count is refused by name rather than wrapped',
  design: 'schema.sql §OVERFLOW ARITHMETIC: QTY = ±9e18 raw at 1e8; numeric(20,8) permits 1e12 units. crate::scaled::from_decimal_string returns OutOfRange before the column CHECK is reached',
  consequence: 'an integer that wrapped would land inside the CHECK’s bounds as a plausible, wrong quantity — the one failure mode a bounded integer column cannot catch, because by then the value looks fine',
  parity: 'divergent',
  reason:
    'numeric(20,8) holds 1e12 units and stores it; the local INTEGER column counts hundred-millionths and cannot. '
    + 'Refused at the boundary rather than at the CHECK so the refusal names the FIGURE rather than the column, which is '
    + 'what a restore needs in order to say which row it could not keep. DECIDED, and stated in schema.sql before the '
    + 'verbs existed.',

  command: {
    verb: 'create_investment',
    payload: {
      id: NEW_HOLDING,
      user_id: USER,
      account_id: EVERYDAY,
      symbol: 'AAAA.L',
      name: 'A Listed Company plc',
      // 9e11 units. Chosen against BOTH ceilings rather than picked large: it
      // is inside numeric(20,8) (which holds twelve digits before the point)
      // and outside int64 at 1e8 (9e11 × 1e8 = 9e19, against a ceiling of
      // 9.22e18). A round 1e12 would have been refused by Postgres too, and for
      // a different reason — its own numeric overflow — which would have proved
      // the engines agree about a case neither can represent.
      quantity: '900000000000',
      // Small enough that the DERIVED cost stays inside numeric(10,2): 9e11 ×
      // 0.0001 is £90,000,000.00, just under that column's own ceiling. Getting
      // this wrong makes Postgres refuse the row for the cost rather than accept
      // it for the quantity, and the spec then measures the wrong divergence.
      purchase_price: '0.0001',
      currency: 'GBP',
      asset_type: 'stock',
    },
  },

  expect: {
    sqlite: { outcome: 'refused', error: 'figure_out_of_range' },
    postgres: { outcome: 'ok' },
  },

  state: [
    investmentShape(NEW_HOLDING, {
      sqlite: 'GONE',
      postgres:
        'AAAA.L:A Listed Company plc:900000000000.00000000:90000000.00:-:0.00010000:stock:GBP:-:0001:-',
    }),
    holdingsOwnedBy(USER, { sqlite: '0', postgres: '1' }),
    balanceIdentityHolds(EVERYDAY),
  ],
};
