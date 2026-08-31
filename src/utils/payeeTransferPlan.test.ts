/**
 * planPayeeTransfers — which rows of a payee can just be converted, and which
 * have to be asked about first.
 *
 * The rules worth pinning are the ones that decide whether money is invented:
 * an existing row over there is offered to exactly ONE transaction, a row
 * another payee in the same press is about to convert is offered to nobody, and
 * a currency boundary refuses out loud instead of copying this row's digits
 * into an account that counts in something else.
 */

import { describe, it, expect } from 'vitest';
import {
  planPayeeTransfers,
  PAYEE_TRANSFER_REFUSALS,
  type PayeeTransferBatch,
} from './payeeTransferPlan';
import type { Account, Transaction } from '../types';

const CURRENT = 'acc-current';
const CARD = 'acc-card';
const EUROS = 'acc-euros';

const ACCOUNTS: Account[] = [
  { id: CURRENT, name: 'Current Account', type: 'current', balance: 0, currency: 'GBP', lastUpdated: new Date('2026-05-01') },
  { id: CARD, name: 'American Express', type: 'credit', balance: 0, currency: 'GBP', lastUpdated: new Date('2026-05-01') },
  { id: EUROS, name: 'Holiday Euros', type: 'savings', balance: 0, currency: 'EUR', lastUpdated: new Date('2026-05-01') },
];

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-05-10'),
  amount: -250,
  description: 'AMERICAN EXPRESS',
  category: '',
  accountId: CURRENT,
  type: 'expense',
  ...over,
});

/** One payee row's instruction, in the shape the modal hands over. */
const batch = (transactions: Transaction[], targetAccountId = CARD): PayeeTransferBatch => ({
  key: 'AMERICAN EXPRESS|expense',
  displayName: 'AMERICAN EXPRESS',
  transactions,
  targetAccountId,
});

describe('planPayeeTransfers — rows with nothing on the other side', () => {
  it('creates the other side outright when the target account holds nothing like it', () => {
    const payments = [txn({ id: 'a' }), txn({ id: 'b', date: new Date('2026-06-10') })];

    const plan = planPayeeTransfers([batch(payments)], payments, { accounts: ACCOUNTS });

    expect(plan.createOutright.map(c => c.transaction.id)).toEqual(['a', 'b']);
    expect(plan.needsConfirmation).toHaveLength(0);
    expect(plan.refused).toHaveLength(0);
  });

  it('creates outright when the only opposite row is outside the four-day window', () => {
    const payment = txn({ id: 'a', date: new Date('2026-05-10') });
    const tooFar = txn({ id: 'far', accountId: CARD, amount: 250, date: new Date('2026-05-16') });

    const plan = planPayeeTransfers([batch([payment])], [payment, tooFar], { accounts: ACCOUNTS });

    expect(plan.createOutright.map(c => c.transaction.id)).toEqual(['a']);
    expect(plan.needsConfirmation).toHaveLength(0);
  });

  it('creates outright when the amount over there differs by a penny', () => {
    const payment = txn({ id: 'a', amount: -250 });
    const nearly = txn({ id: 'nearly', accountId: CARD, amount: 250.01 });

    const plan = planPayeeTransfers([batch([payment])], [payment, nearly], { accounts: ACCOUNTS });

    expect(plan.createOutright.map(c => c.transaction.id)).toEqual(['a']);
  });

  it('creates outright when the row over there points the same way as this one', () => {
    const payment = txn({ id: 'a', amount: -250 });
    const alsoOut = txn({ id: 'out', accountId: CARD, amount: -250 });

    const plan = planPayeeTransfers([batch([payment])], [payment, alsoOut], { accounts: ACCOUNTS });

    expect(plan.createOutright.map(c => c.transaction.id)).toEqual(['a']);
  });
});

describe('planPayeeTransfers — rows that have to be asked about', () => {
  it('offers the exactly-opposite row a day later as the other side', () => {
    const payment = txn({ id: 'a', date: new Date('2026-05-10') });
    const overThere = txn({
      id: 'card-1',
      accountId: CARD,
      amount: 250,
      date: new Date('2026-05-11'),
      description: 'PAYMENT RECEIVED - THANK YOU',
    });

    const plan = planPayeeTransfers([batch([payment])], [payment, overThere], { accounts: ACCOUNTS });

    expect(plan.createOutright).toHaveLength(0);
    expect(plan.needsConfirmation).toHaveLength(1);
    expect(plan.needsConfirmation[0].transaction.id).toBe('a');
    expect(plan.needsConfirmation[0].candidate.transaction.id).toBe('card-1');
    expect(plan.needsConfirmation[0].targetAccountId).toBe(CARD);
    expect(plan.needsConfirmation[0].displayName).toBe('AMERICAN EXPRESS');
    expect(plan.needsConfirmation[0].otherMatches).toBe(0);
  });

  it('offers the closest date first and counts the other matches rather than hiding them', () => {
    const payment = txn({ id: 'a', date: new Date('2026-05-10') });
    const twoDaysOut = txn({ id: 'card-far', accountId: CARD, amount: 250, date: new Date('2026-05-12') });
    const sameDay = txn({ id: 'card-near', accountId: CARD, amount: 250, date: new Date('2026-05-10') });

    const plan = planPayeeTransfers(
      [batch([payment])],
      [payment, twoDaysOut, sameDay],
      { accounts: ACCOUNTS }
    );

    expect(plan.needsConfirmation[0].candidate.transaction.id).toBe('card-near');
    expect(plan.needsConfirmation[0].otherMatches).toBe(1);
  });

  it('never offers one existing row to two transactions — the second creates instead', () => {
    const first = txn({ id: 'a', date: new Date('2026-05-10') });
    const second = txn({ id: 'b', date: new Date('2026-05-11') });
    const onlyOne = txn({ id: 'card-1', accountId: CARD, amount: 250, date: new Date('2026-05-10') });

    const plan = planPayeeTransfers(
      [batch([first, second])],
      [first, second, onlyOne],
      { accounts: ACCOUNTS }
    );

    expect(plan.needsConfirmation.map(q => q.transaction.id)).toEqual(['a']);
    expect(plan.needsConfirmation[0].candidate.transaction.id).toBe('card-1');
    expect(plan.createOutright.map(c => c.transaction.id)).toEqual(['b']);
  });

  it('claims counterparts oldest-first, whatever order the payee’s rows arrive in', () => {
    const older = txn({ id: 'older', date: new Date('2026-05-10') });
    const newer = txn({ id: 'newer', date: new Date('2026-05-11') });
    const onlyOne = txn({ id: 'card-1', accountId: CARD, amount: 250, date: new Date('2026-05-10') });
    const ledger = [older, newer, onlyOne];

    const asListed = planPayeeTransfers([batch([older, newer])], ledger, { accounts: ACCOUNTS });
    const reversed = planPayeeTransfers([batch([newer, older])], ledger, { accounts: ACCOUNTS });

    expect(asListed.needsConfirmation.map(q => q.transaction.id)).toEqual(['older']);
    expect(reversed.needsConfirmation.map(q => q.transaction.id)).toEqual(['older']);
    expect(reversed.createOutright.map(c => c.transaction.id)).toEqual(['newer']);
  });

  it('shares the claim across payees pointing at the same account', () => {
    const amex = txn({ id: 'a', date: new Date('2026-05-10') });
    const cardPayment = txn({ id: 'b', description: 'CARD PAYMENT', date: new Date('2026-05-11') });
    const onlyOne = txn({ id: 'card-1', accountId: CARD, amount: 250, date: new Date('2026-05-10') });

    const plan = planPayeeTransfers(
      [
        batch([amex]),
        { key: 'CARD PAYMENT|expense', displayName: 'CARD PAYMENT', transactions: [cardPayment], targetAccountId: CARD },
      ],
      [amex, cardPayment, onlyOne],
      { accounts: ACCOUNTS }
    );

    expect(plan.needsConfirmation.map(q => q.transaction.id)).toEqual(['a']);
    expect(plan.createOutright.map(c => c.transaction.id)).toEqual(['b']);
  });

  it('never offers a row another payee in the same press is about to convert', () => {
    const payment = txn({ id: 'a', date: new Date('2026-05-10') });
    // Sitting in the card account, opposite in sign, same day — a perfect
    // match on the numbers, and spoken for: its own payee row is converting it.
    const alsoConverting = txn({
      id: 'card-1',
      accountId: CARD,
      amount: 250,
      date: new Date('2026-05-10'),
      description: 'REFUND',
    });

    const plan = planPayeeTransfers(
      [
        batch([payment]),
        { key: 'REFUND|income', displayName: 'REFUND', transactions: [alsoConverting], targetAccountId: 'acc-savings' },
      ],
      [payment, alsoConverting],
      { accounts: ACCOUNTS }
    );

    expect(plan.needsConfirmation).toHaveLength(0);
    expect(plan.createOutright.map(c => c.transaction.id)).toEqual(['a', 'card-1']);
  });

  it('leaves split parents and already-linked rows out of the candidates', () => {
    const payment = txn({ id: 'a', date: new Date('2026-05-10') });
    const split = txn({ id: 'card-split', accountId: CARD, amount: 250, isSplit: true });
    const taken = txn({ id: 'card-taken', accountId: CARD, amount: 250, linkedTransferId: 'somewhere' });

    const plan = planPayeeTransfers(
      [batch([payment])],
      [payment, split, taken],
      { accounts: ACCOUNTS }
    );

    expect(plan.needsConfirmation).toHaveLength(0);
    expect(plan.createOutright.map(c => c.transaction.id)).toEqual(['a']);
  });
});

describe('planPayeeTransfers — what it refuses, and why', () => {
  it('refuses a row already sitting in the account it would move to', () => {
    const payment = txn({ id: 'a', accountId: CARD });

    const plan = planPayeeTransfers([batch([payment])], [payment], { accounts: ACCOUNTS });

    expect(plan.refused).toHaveLength(1);
    expect(plan.refused[0].reason).toBe('same-account');
    expect(plan.createOutright).toHaveLength(0);
    expect(plan.needsConfirmation).toHaveLength(0);
  });

  it('refuses across a currency boundary rather than copying the digits over', () => {
    const payment = txn({ id: 'a' });
    const overThere = txn({ id: 'eur-1', accountId: EUROS, amount: 290, date: new Date('2026-05-10') });

    const plan = planPayeeTransfers(
      [batch([payment], EUROS)],
      [payment, overThere],
      { accounts: ACCOUNTS }
    );

    expect(plan.refused.map(r => r.reason)).toEqual(['cross-currency']);
    expect(plan.createOutright).toHaveLength(0);
    expect(plan.needsConfirmation).toHaveLength(0);
    expect(PAYEE_TRANSFER_REFUSALS['cross-currency']).toContain('another currency');
  });

  it('treats an unknown currency as the same one, so the strict match still applies', () => {
    // No accounts at all: a closed account is not in the app's list either, and
    // "unknown reads as same" is what keeps the exact-amount rule in force.
    const payment = txn({ id: 'a', date: new Date('2026-05-10') });
    const overThere = txn({ id: 'card-1', accountId: CARD, amount: 250, date: new Date('2026-05-10') });

    const plan = planPayeeTransfers([batch([payment])], [payment, overThere]);

    expect(plan.refused).toHaveLength(0);
    expect(plan.needsConfirmation.map(q => q.candidate.transaction.id)).toEqual(['card-1']);
  });

  it('refuses rows that are already transfers, splits or worth nothing', () => {
    const already = txn({ id: 'a', type: 'transfer' });
    const linked = txn({ id: 'b', linkedTransferId: 'other-side' });
    const split = txn({ id: 'c', isSplit: true });
    const nothing = txn({ id: 'd', amount: 0 });
    const rows = [already, linked, split, nothing];

    const plan = planPayeeTransfers([batch(rows)], rows, { accounts: ACCOUNTS });

    expect(plan.refused.map(r => [r.transaction.id, r.reason])).toEqual([
      ['a', 'already-a-transfer'],
      ['b', 'already-a-transfer'],
      ['c', 'split'],
      ['d', 'zero-amount'],
    ]);
    expect(plan.createOutright).toHaveLength(0);
  });

  it('has a sentence for every refusal it can hand back', () => {
    for (const message of Object.values(PAYEE_TRANSFER_REFUSALS)) {
      expect(message.length).toBeGreaterThan(20);
    }
  });
});
