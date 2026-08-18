import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import {
  AMOUNT_DP,
  RATE_DP,
  buildFxRecord,
  deriveRate,
  describeRate,
  destinationForRate,
  rateForDestination,
  rateToDisplayString,
  rateToStorageString,
  readFxRecord,
  sourceForRate,
} from '../fx';

/**
 * The arithmetic behind a cross-currency transfer.
 *
 * Every figure here is invented. The repo is public, so no test in it carries a
 * real balance, a real payee or a real institution.
 */
describe('fx', () => {
  describe('deriveRate — the rate two real amounts imply', () => {
    it('divides destination by source', () => {
      // 200 of one currency became 158 of another.
      const result = deriveRate(-200, 158);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.toString()).toBe('0.79');
    });

    it('ignores the signs, because a transfer\'s legs are always opposite', () => {
      // Money leaves one account and arrives in the other, so the raw ratio of
      // the signed amounts would be negative every time and would mean nothing.
      const signed = deriveRate(-200, 158);
      const unsigned = deriveRate(200, 158);
      expect(signed.ok && unsigned.ok).toBe(true);
      if (!signed.ok || !unsigned.ok) return;
      expect(signed.value.toString()).toBe(unsigned.value.toString());
      expect(signed.value.isPositive()).toBe(true);
    });

    it('holds ten decimal places, matching the local edition\'s fx_rate_e10 scale', () => {
      expect(RATE_DP).toBe(10);
      // 1 / 3 is the standard witness for a ratio that does not terminate.
      const result = deriveRate(3, 1);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.toString()).toBe('0.3333333333');
    });

    it('rounds the tenth place HALF_UP, not toward zero', () => {
      // 2/3 = 0.6666666666|66… — the eleventh digit is 6, so the tenth goes up.
      const result = deriveRate(3, 2);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.toString()).toBe('0.6666666667');
    });

    it('refuses a zero source rather than dividing by it', () => {
      const result = deriveRate(0, 158);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe('zero-source');
    });

    it('refuses input that is not a number', () => {
      const result = deriveRate('not a number', 158);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe('not-a-number');
    });

    it('accepts Decimal, number and string alike', () => {
      const fromDecimal = deriveRate(new Decimal('-200'), new Decimal('158'));
      const fromNumber = deriveRate(-200, 158);
      const fromString = deriveRate('-200', '158');
      expect(fromDecimal.ok && fromNumber.ok && fromString.ok).toBe(true);
      if (!fromDecimal.ok || !fromNumber.ok || !fromString.ok) return;
      expect(fromDecimal.value.toString()).toBe('0.79');
      expect(fromNumber.value.toString()).toBe('0.79');
      expect(fromString.value.toString()).toBe('0.79');
    });
  });

  describe('destinationForRate — the dialog typing left to right', () => {
    it('multiplies the source by the rate, to the penny', () => {
      expect(AMOUNT_DP).toBe(2);
      const result = destinationForRate(-200, '0.79');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.toString()).toBe('158');
    });

    it('rounds the penny HALF_UP', () => {
      // 100 x 0.795 = 79.5 exactly at the half-penny; HALF_UP takes it to 79.5,
      // and a third place that lands on 5 goes up rather than to even.
      const result = destinationForRate(100, '0.7955');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.toString()).toBe('79.55');

      const halfPenny = destinationForRate(100, '0.79555');
      expect(halfPenny.ok).toBe(true);
      if (!halfPenny.ok) return;
      expect(halfPenny.value.toString()).toBe('79.56');
    });

    it('returns a positive amount — the caller applies the leg\'s sign', () => {
      const result = destinationForRate(-200, '0.79');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.isPositive()).toBe(true);
    });

    it('does not lose pounds to a rate rounded too early', () => {
      // The reason a rate is not held at 2dp. A rate truncated to 0.79 against
      // a five-figure amount differs from the full quote by real money.
      const full = destinationForRate(50000, '0.7912345678');
      const truncated = destinationForRate(50000, '0.79');
      expect(full.ok && truncated.ok).toBe(true);
      if (!full.ok || !truncated.ok) return;
      const difference = full.value.minus(truncated.value).abs();
      expect(difference.greaterThan(60)).toBe(true);
    });

    it('refuses input that is not a number', () => {
      const result = destinationForRate(200, 'abc');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe('not-a-number');
    });
  });

  describe('sourceForRate — destinationForRate run backwards', () => {
    it('divides the destination by the rate, to the penny', () => {
      // £158 that arrived at 0.79 was $200 before the conversion.
      const result = sourceForRate('158', '0.79');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.toString()).toBe('200');
    });

    it('round-trips with destinationForRate up to one penny of rounding', () => {
      const forward = destinationForRate('127.5', '0.7843');
      expect(forward.ok).toBe(true);
      if (!forward.ok) return;
      const back = sourceForRate(forward.value, '0.7843');
      expect(back.ok).toBe(true);
      if (!back.ok) return;
      expect(back.value.minus('127.5').abs().lessThanOrEqualTo('0.01')).toBe(true);
    });

    it('discards sign, like every amount here — the legs carry the signs', () => {
      const result = sourceForRate(-158, '0.79');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.isPositive()).toBe(true);
    });

    it('refuses a zero or negative rate as not-a-number — no real pair has one', () => {
      const zero = sourceForRate(100, '0');
      expect(zero.ok).toBe(false);
      if (zero.ok) return;
      expect(zero.reason).toBe('not-a-number');

      const negative = sourceForRate(100, '-0.79');
      expect(negative.ok).toBe(false);
      if (negative.ok) return;
      expect(negative.reason).toBe('not-a-number');
    });
  });

  describe('the two directions agree', () => {
    it('round-trips a rate through an amount and back', () => {
      const destination = destinationForRate(-200, '0.79');
      expect(destination.ok).toBe(true);
      if (!destination.ok) return;

      const back = rateForDestination(-200, destination.value);
      expect(back.ok).toBe(true);
      if (!back.ok) return;
      expect(back.value.toString()).toBe('0.79');
    });

    it('round-trips an amount through a rate and back', () => {
      const rate = rateForDestination(-320, 250);
      expect(rate.ok).toBe(true);
      if (!rate.ok) return;

      const back = destinationForRate(-320, rate.value);
      expect(back.ok).toBe(true);
      if (!back.ok) return;
      expect(back.value.toString()).toBe('250');
    });

    it('comes back to the SAME PENNY even when the ratio does not terminate', () => {
      // This is what ten places buys, stated as an assertion. 100/300 has no
      // terminating decimal, so the stored rate is an approximation — but at
      // RATE_DP it is close enough that multiplying back lands on the original
      // amount exactly: 300 x 0.3333333333 = 99.99999999, which is 100.00 to
      // the penny. Held at 2dp the same round-trip would return 99.00, and the
      // person would watch their own figure change after they typed it.
      const rate = rateForDestination(-300, 100);
      expect(rate.ok).toBe(true);
      if (!rate.ok) return;
      expect(rate.value.toString()).toBe('0.3333333333');

      const back = destinationForRate(-300, rate.value);
      expect(back.ok).toBe(true);
      if (!back.ok) return;
      expect(back.value.toString()).toBe('100');

      // The 2dp counterfactual the comment above claims.
      const coarse = destinationForRate(-300, '0.33');
      expect(coarse.ok).toBe(true);
      if (!coarse.ok) return;
      expect(coarse.value.toString()).toBe('99');
    });
  });

  describe('rateToStorageString — an exact decimal string, never a float', () => {
    it('drops trailing zeros rather than padding to ten places', () => {
      expect(rateToStorageString(new Decimal('0.79'))).toBe('0.79');
      expect(rateToStorageString(new Decimal('2'))).toBe('2');
    });

    it('keeps every digit of a long rate', () => {
      expect(rateToStorageString(new Decimal('0.3333333333'))).toBe('0.3333333333');
    });

    it('is exact where a float is not', () => {
      // 0.1 + 0.2 is the canonical float failure. The stored string is the
      // decimal value, so it never acquires the tail a float would.
      const rate = new Decimal('0.1').plus('0.2');
      expect(rateToStorageString(rate)).toBe('0.3');
      expect(rateToStorageString(rate)).not.toContain('0.30000000');
    });
  });

  describe('buildFxRecord / readFxRecord', () => {
    const asOf = new Date('2026-08-12T14:02:00.000Z');

    it('records the rate as a string, with its source and timestamp', () => {
      const record = buildFxRecord(new Decimal('0.79'), 'api', asOf);
      expect(record).toEqual({
        rate: '0.79',
        source: 'api',
        asOf: '2026-08-12T14:02:00.000Z',
      });
      expect(typeof record.rate).toBe('string');
    });

    it('reads back what it wrote, through a metadata blob', () => {
      const record = buildFxRecord(new Decimal('0.3333333333'), 'derived', asOf);
      expect(readFxRecord({ fx: record })).toEqual(record);
    });

    it('survives other writers sharing the blob', () => {
      const record = buildFxRecord(new Decimal('0.79'), 'manual', asOf);
      expect(readFxRecord({ fx: record, somethingElse: { a: 1 } })).toEqual(record);
    });

    it('reads anything shaped wrong as absent rather than throwing', () => {
      // metadata is an open jsonb blob; a render must not crash on a stranger's
      // key. Each of these is a plausible way for the shape to be wrong.
      expect(readFxRecord(null)).toBeNull();
      expect(readFxRecord(undefined)).toBeNull();
      expect(readFxRecord('a string')).toBeNull();
      expect(readFxRecord({})).toBeNull();
      expect(readFxRecord({ fx: null })).toBeNull();
      expect(readFxRecord({ fx: {} })).toBeNull();
      expect(readFxRecord({ fx: { rate: '0.79' } })).toBeNull();
      expect(readFxRecord({ fx: { rate: '0.79', source: 'api' } })).toBeNull();
      expect(readFxRecord({ fx: { rate: 0.79, source: 'api', asOf: 'x' } })).toBeNull();
      expect(readFxRecord({ fx: { rate: '0.79', source: 'guess', asOf: 'x' } })).toBeNull();
      expect(readFxRecord({ fx: { rate: '', source: 'api', asOf: 'x' } })).toBeNull();
      expect(readFxRecord({ fx: { rate: 'abc', source: 'api', asOf: 'x' } })).toBeNull();
    });

    it('refuses a rate stored as a number, because that is a float', () => {
      // The local schema banned the old float `transferMetadata.exchangeRate`
      // from the blob for exactly this reason. A number here is that mistake
      // returning under a new key, so it does not read as a valid record.
      expect(readFxRecord({ fx: { rate: 0.79, source: 'api', asOf: '2026-08-12T14:02:00.000Z' } })).toBeNull();
    });
  });

  describe('describeRate', () => {
    it('quotes the rate as a sentence naming both currencies', () => {
      expect(describeRate('0.79', { from: 'USD', to: 'GBP' })).toBe('1 USD = 0.79 GBP');
    });

    it('takes a Decimal and prints it without padding', () => {
      expect(describeRate(new Decimal('2'), { from: 'GBP', to: 'USD' })).toBe('1 GBP = 2 USD');
    });
  });
});

describe('a rate is QUOTED shorter than it is STORED (Claude Design §9.1)', () => {
  const toDecimal = (v: string): Decimal => new Decimal(v);
  /*
   * Storage keeps ten places because a DERIVED rate is a division and division
   * does not terminate: $100 arriving as £74.07 gives 0.7407407407…, and the
   * stored figure has to reproduce the amounts it came from.
   *
   * Display has the opposite duty. Ten places presented a float artefact as
   * precision the quote never had, in an app that measures its numbers
   * carefully everywhere else.
   */
  it('shows four places where it stores ten', () => {
    const derived = deriveRate(100, 74.074074);
    expect(derived.ok).toBe(true);
    if (!derived.ok) return;
    expect(rateToStorageString(derived.value)).toMatch(/^0\.7407407/);
    expect(rateToDisplayString(derived.value)).toBe('0.7407');
  });

  it('keeps a short rate short — no padding to four', () => {
    // "1 GBP = 2 USD", not "2.0000".
    expect(rateToDisplayString(toDecimal('2'))).toBe('2');
    expect(rateToDisplayString(toDecimal('1.35'))).toBe('1.35');
  });

  it('does not round an exotic pair away to zero', () => {
    // 1 JPY = 0.0000052 GBP is 0.0000 at four places, and a rate shown as zero
    // is worse than a long one. Significant digits take over.
    const tiny = rateToDisplayString(toDecimal('0.0000052'));
    expect(tiny).not.toBe('0');
    expect(Number(tiny)).toBeGreaterThan(0);
  });

  it('reconciles against the recorded amounts, which is the point', () => {
    // Design's requirement: what is displayed must be what the figures agree
    // with. $100 at the DISPLAYED 0.7407 is £74.07 — the amount recorded.
    const derived = deriveRate(100, 74.074074);
    if (!derived.ok) throw new Error('rate should derive');
    const displayed = toDecimal(rateToDisplayString(derived.value));
    expect(toDecimal('100').times(displayed).toDecimalPlaces(2).toString()).toBe('74.07');
  });
});
