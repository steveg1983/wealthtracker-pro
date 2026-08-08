import {
  USER, EVERYDAY, WEEKLY_SHOP, OUTGOINGS, CORNER_SHOP,
  balanceOf, balanceIdentityHolds, splitLines, splitSumHolds, auditShape,
} from './_shared.mjs';

// TS-M3 (canonical #25), from the side the ledger can actually prove. The rule
// itself — "a split line's STORED SIGN comes from its own category's direction,
// not the parent's" — lives where the line is composed
// (`src/utils/transactionSplits.ts:88-108`), because it is a decision about what
// to send. What the WRITER owes it is the ability to carry the result: a split
// whose lines run in opposite directions has to survive storage unaltered.
//
// The shape here is the real one, not a contrivance: £30 of shopping with a £5
// item taken back at the till. The parent is −25.00, one line is −30.00 and the
// other is +5.00, and every part of that has to stay true. A writer that
// "helpfully" coerced every line to the parent's sign would store −30.00 and
// −5.00, sum to −35.00, and then either fail the sum check or — worse — pass a
// check it had already broken.
//
// It is also the case that makes S-1 worth stating as a SIGNED sum rather than a
// magnitude: |−30| + |5| is 35, and the only reading in which these two lines
// make one −25.00 transaction is the arithmetic one.
export default {
  invariant: 'TS-M3',
  title: 'one split may hold a line of each direction, and both signs survive storage',
  design: 'set_transaction_splits_with_legs 20260806094058:254-257 stores the signed amount it is given; the sign is decided at src/utils/transactionSplits.ts:88-108',
  consequence: 'a refund inside a spend is stored with the spend\'s sign, S-1 then "passes" on numbers that are wrong, and cross-type filing — a first-class feature of the edit modal — stops working',
  parity: 'match',

  command: {
    verb: 'set_transaction_splits_with_legs',
    payload: {
      id: CORNER_SHOP,
      user_id: USER,
      expected_amount: '-25.00',
      splits: [
        { category: WEEKLY_SHOP, amount: '-30.00', memo: 'the shopping' },
        { category: OUTGOINGS, amount: '5.00', memo: 'taken back at the till' },
      ],
    },
  },

  expect: { outcome: 'ok' },
  result: { id: CORNER_SHOP, amount: '-25.00', is_split: true },

  state: [
    splitLines(
      CORNER_SHOP,
      '1:-30.00:Weekly shop:-:-:the shopping | 2:5.00:Outgoings:-:-:taken back at the till',
    ),
    splitSumHolds(CORNER_SHOP),
    balanceOf(EVERYDAY, '-25.00'),
    balanceIdentityHolds(EVERYDAY),
    auditShape('transaction/update'),
  ],
};
