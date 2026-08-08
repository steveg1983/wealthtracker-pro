import { describe, it, expect } from 'vitest';
import {
  cardAmountToAppSigned,
  cardBalanceToAppBalance,
  cardDisplayName,
  cardMask,
} from './cardNormalization';

describe('cardAmountToAppSigned', () => {
  it('negates a purchase (card-positive) into an app expense (negative)', () => {
    // TrueLayer docs: SAINSBURYS purchase, amount 24.25, DEBIT
    expect(cardAmountToAppSigned(24.25)).toBe(-24.25);
  });

  it('negates a payment/refund (card-negative) into app income (positive)', () => {
    expect(cardAmountToAppSigned(-500)).toBe(500);
  });

  it('rounds to 2dp HALF_UP like the rest of the pipeline', () => {
    expect(cardAmountToAppSigned(10.005)).toBe(-10.01);
  });

  it('never emits -0 and zeroes non-finite input', () => {
    expect(Object.is(cardAmountToAppSigned(0), -0)).toBe(false);
    expect(cardAmountToAppSigned(Number.NaN)).toBe(0);
    expect(cardAmountToAppSigned(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('cardBalanceToAppBalance', () => {
  it('turns owed (positive current) into a negative app liability', () => {
    // TrueLayer docs example: current 20.0 on a 3300 limit
    expect(cardBalanceToAppBalance(20)).toBe(-20);
  });

  it('keeps a credit balance on the card (negative current) positive in-app', () => {
    // Overpaid card: provider reports current -15.50
    expect(cardBalanceToAppBalance(-15.5)).toBe(15.5);
  });

  it('refuses a non-figure rather than reporting it as nothing owed', () => {
    // The old contract answered 0 here, so an issuer that sent no balance was
    // recorded as a card with nothing on it. Callers must handle "no figure"
    // themselves — see cardBalanceSnapshot.
    expect(() => cardBalanceToAppBalance(Number.NaN)).toThrow(/finite/);
    expect(() => cardBalanceToAppBalance(Number.POSITIVE_INFINITY)).toThrow(/finite/);
  });

  it('never emits -0', () => {
    expect(Object.is(cardBalanceToAppBalance(0), -0)).toBe(false);
  });
});

describe('cardDisplayName', () => {
  it('prefers the provider display name', () => {
    expect(cardDisplayName(
      { display_name: 'Club Credit Card', card_network: 'VISA', partial_card_number: '0044' },
      'Lloyds'
    )).toBe('Club Credit Card');
  });

  it('falls back to network + masked number', () => {
    expect(cardDisplayName(
      { card_network: 'AMEX', partial_card_number: '1005' },
      'American Express'
    )).toBe('AMEX •••• 1005');
  });

  it('falls back to the institution name when the card is anonymous', () => {
    expect(cardDisplayName({}, 'American Express')).toBe('American Express');
  });
});

describe('cardMask', () => {
  it('takes the last 4 of the partial number', () => {
    expect(cardMask('0044')).toBe('0044');
    expect(cardMask('XXXX XXXX XXXX 1005')).toBe('1005');
  });

  it('handles short or missing values', () => {
    expect(cardMask('44')).toBe('44');
    expect(cardMask(undefined)).toBeUndefined();
    expect(cardMask('')).toBeUndefined();
  });
});
