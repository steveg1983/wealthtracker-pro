import { describe, it, expect } from 'vitest';
import {
  crossedCurrencies,
  destinationLegAmount,
  fxForLinkedPair,
  withFxRecord,
} from '../crossCurrencyTransfer';
import { readFxRecord } from '../fx';
import { toDecimal } from '../decimal';
import type { Account, Transaction } from '../../types';

const anAccount = (id: string, currency: string): Account => ({
  id,
  name: id,
  type: 'checking',
  balance: 0,
  currency,
  isActive: true,
  lastUpdated: new Date('2026-08-12'),
});

const aTransaction = (id: string, accountId: string, amount: number, rest: Partial<Transaction> = {}): Transaction => ({
  id,
  accountId,
  amount,
  date: new Date('2026-08-12'),
  description: 'Moved',
  category: 'cat',
  type: 'transfer',
  ...rest,
});

const GBP = anAccount('gbp', 'GBP');
const USD = anAccount('usd', 'USD');
const ACCOUNTS = [GBP, USD];
const AT = new Date('2026-08-12T14:02:00.000Z');

describe('crossedCurrencies', () => {
  it('names the pair only when it is a real boundary', () => {
    expect(crossedCurrencies(ACCOUNTS, 'gbp', 'usd')).toEqual({ from: 'GBP', to: 'USD' });
    expect(crossedCurrencies(ACCOUNTS, 'usd', 'gbp')).toEqual({ from: 'USD', to: 'GBP' });
    expect(crossedCurrencies(ACCOUNTS, 'gbp', 'gbp')).toBeNull();
  });

  it('reads an unknown account as NOT a boundary, so the strict rules apply', () => {
    // The engines make the same choice (link_transfer_pair's crossed_currencies
    // and the RPC's `IS NOT NULL` tests). Getting it backwards here would open
    // a dialog for a pair the engines are about to refuse.
    expect(crossedCurrencies(ACCOUNTS, 'gbp', 'nobody')).toBeNull();
    expect(crossedCurrencies(ACCOUNTS, 'nobody', 'usd')).toBeNull();
  });
});

describe('destinationLegAmount', () => {
  it('gives the far side the opposite sign, and the confirmed magnitude untouched', () => {
    expect(destinationLegAmount(-30, toDecimal('38.17')).toString()).toBe('38.17');
    expect(destinationLegAmount(30, toDecimal('38.17')).toString()).toBe('-38.17');
  });

  it('ignores the sign the person typed, because direction is not theirs to give', () => {
    // Every box in the dialog is a magnitude; the legs carry the direction.
    expect(destinationLegAmount(-30, toDecimal('-38.17')).toString()).toBe('38.17');
  });
});

describe('fxForLinkedPair', () => {
  it('derives the rate the two REAL amounts imply', () => {
    const fx = fxForLinkedPair(
      ACCOUNTS,
      aTransaction('a', 'gbp', -30),
      aTransaction('b', 'usd', 38.17),
      AT
    );

    // 38.17 / 30 — what the money actually did, not what a quote said it
    // should have done.
    expect(fx).toEqual({
      rate: '1.2723333333',
      source: 'derived',
      asOf: AT.toISOString(),
    });
  });

  it('is positive whichever way round the legs are given', () => {
    const forward = fxForLinkedPair(ACCOUNTS, aTransaction('a', 'gbp', -30), aTransaction('b', 'usd', 38.17), AT);
    const backward = fxForLinkedPair(ACCOUNTS, aTransaction('b', 'usd', 38.17), aTransaction('a', 'gbp', -30), AT);
    expect(forward?.rate).toBe('1.2723333333');
    // The reciprocal, and still positive: a signed ratio would be negative
    // every time and would mean nothing.
    // Ten places, the fx_rate_e10 scale — not the nine a trailing-zero strip
    // would leave. 30 ÷ 38.17 does not terminate, so this is the rounding.
    expect(backward?.rate).toBe('0.7859575583');
  });

  it('records nothing when the accounts share a currency', () => {
    const sameCurrency = [GBP, anAccount('gbp2', 'GBP')];
    expect(
      fxForLinkedPair(sameCurrency, aTransaction('a', 'gbp', -30), aTransaction('b', 'gbp2', 30), AT)
    ).toBeNull();
  });

  it('never downgrades a CONFIRMED rate to a derived one', () => {
    // The creation flow stamps both legs before linking. Re-deriving here
    // would produce the same number wearing the wrong provenance — a stored
    // 'manual' quietly becoming 'derived' is a lie about who is answerable for
    // the figure, which is the whole point of storing a source at all.
    const confirmed = { fx: { rate: '1.27', source: 'manual', asOf: AT.toISOString() } };
    expect(
      fxForLinkedPair(
        ACCOUNTS,
        aTransaction('a', 'gbp', -30, { metadata: confirmed }),
        aTransaction('b', 'usd', 38.17),
        AT
      )
    ).toBeNull();
    // …from either leg.
    expect(
      fxForLinkedPair(
        ACCOUNTS,
        aTransaction('a', 'gbp', -30),
        aTransaction('b', 'usd', 38.17, { metadata: confirmed }),
        AT
      )
    ).toBeNull();
  });

  it('records nothing rather than throwing when the arithmetic cannot go through', () => {
    // Unreachable behind a successful link — the engines refuse a zero side —
    // and a metadata stamp is not worth failing a link that already worked.
    expect(
      fxForLinkedPair(ACCOUNTS, aTransaction('a', 'gbp', 0), aTransaction('b', 'usd', 38.17), AT)
    ).toBeNull();
  });

  it('produces a record readFxRecord accepts, with the rate as a STRING', () => {
    const fx = fxForLinkedPair(ACCOUNTS, aTransaction('a', 'gbp', -30), aTransaction('b', 'usd', 38.17), AT);
    expect(fx).not.toBeNull();
    // The round trip that matters: readFxRecord rejects a number-typed rate,
    // so this proves the stored shape survives its own reader.
    expect(readFxRecord({ fx })).toEqual(fx);
    expect(typeof fx?.rate).toBe('string');
  });
});

describe('withFxRecord', () => {
  it('merges rather than replaces, because metadata is a shared blob', () => {
    const fx = { rate: '1.27', source: 'manual' as const, asOf: AT.toISOString() };
    expect(withFxRecord({ importedFrom: 'qif' }, fx)).toEqual({ importedFrom: 'qif', fx });
    expect(withFxRecord(undefined, fx)).toEqual({ fx });
  });
});
