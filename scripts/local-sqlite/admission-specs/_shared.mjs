// Fixtures the admission specs repeat. Not a spec: the loader reads only
// `*.spec.mjs`.
//
// EVERY VALUE HERE IS INVENTED. This repository is public and these are the
// shapes a real statement produced, never anybody's figures: the descriptions
// come from the Vitest suites these specs are the successors of, where they
// were already invented for the same reason.
//
// Two conventions worth knowing before writing a spec:
//
//   * **Money is a decimal STRING, always.** That is the boundary rule the
//     whole crate is built on (`crates/wealth-core/src/money.rs`): a JSON
//     number is an IEEE-754 double the moment a parser touches it. The
//     TypeScript oracle converts the string to the `number` its own callers
//     hand it, which is where the two implementations legitimately differ and
//     where three specs deliberately measure the difference.
//   * **Dates are text, and unreadable text is a real input.** Half the rules
//     here are about what happens to a row whose date cannot be read.

export const ACCOUNT = 'current-account';
export const OTHER_ACCOUNT = 'savings';

/** A row the register already holds. */
export const held = (over = {}) => ({
  id: 'held-1',
  account_id: ACCOUNT,
  date: '2027-02-07',
  amount: '0.00',
  description: '',
  ...over,
});

/** A row arriving from the statement file. */
export const incoming = (over = {}) => ({
  date: '2027-02-07',
  amount: '0.00',
  description: '',
  fit_id: null,
  ...over,
});

/** A Money-file transaction, app-shaped. */
export const moneyRow = (over = {}) => ({
  id: 'mny-txn-1',
  account_id: 'mny-acct-1',
  date: '2026-05-10',
  amount: '0.00',
  description: 'Corner Shop',
  type: 'expense',
  ...over,
});

/** A Money-file transaction that is one leg of a transfer. */
export const moneyLeg = (over = {}) => moneyRow({
  type: 'transfer',
  description: 'Card payment',
  transfer_account_id: 'mny-acct-2',
  ...over,
});

/** A transaction the bank feed already wrote. */
export const feedRow = (over = {}) => ({
  id: 'feed-1',
  account_id: 'mny-acct-1',
  date: '2026-05-10',
  amount: '0.00',
  description: 'CORNER SHOP LTD 4471',
  ...over,
});

/** An OFX bank statement's own identifiers. */
export const ofxBank = (over = {}) => ({
  account_id: '12345678',
  bank_id: '123456',
  is_credit_card_statement: false,
  ...over,
});

/** An OFX card statement's own identifiers. Cards quote no sort code. */
export const ofxCard = (over = {}) => ({
  account_id: '4929123456789012',
  is_credit_card_statement: true,
  ...over,
});

/** One of the user's accounts, as the identifier rules read it. */
export const account = (over = {}) => ({
  id: 'acc1',
  type: 'current',
  ...over,
});

/** A category, as the self-transfer rule reads it. */
export const category = (over = {}) => ({
  id: 'groceries',
  is_transfer_category: false,
  ...over,
});

/**
 * The five shapes a re-imported statement produced in production, with invented
 * names and figures. Every row is the same transaction on both sides, and not
 * one has the same description twice: three were truncated by whatever imported
 * them, one is written by a different system entirely, and one was renamed by
 * hand to something the user would recognise later.
 */
export const PAIR_SHAPES = [
  {
    heldDescription: 'Sweep Transfer from account 5566',
    fileDescription: 'Sweep Transfer from account 55667788',
    amount: '9876.54',
  },
  {
    heldDescription: 'Direct Debit - STREAMCO',
    fileDescription: 'Direct Debit - STREAMCO  00110022330044',
    amount: '-63.20',
  },
  {
    heldDescription: 'SAMPLE PERSON A',
    fileDescription: 'Standing Order to MISS A SAMPLE - A SAMPLE',
    amount: '-2500.00',
  },
  {
    heldDescription: 'Nadia',
    fileDescription: 'Immediate Faster Payment (Online) to B EXAMPLE 07-FEB-2027',
    amount: '-410.00',
  },
  {
    heldDescription: 'Direct Debit - TELCO LTD  447',
    fileDescription: 'Direct Debit - TELCO LTD  447221900-00007',
    amount: '-77.45',
  },
];
