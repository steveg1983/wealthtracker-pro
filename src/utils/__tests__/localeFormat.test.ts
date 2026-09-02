/**
 * COUNTS AND SORTING OBEY THE SETTING TOO.
 *
 * #549 made the app's DATES follow Settings ▸ Region & Date Format. It left the
 * other half named but unfixed, in the header of its own guard: a call that
 * passes no locale at all — `(1234).toLocaleString()`, `a.localeCompare(b)` —
 * does not use the setting either. It asks the BROWSER.
 *
 * That is invisible from a UK desk, which is what makes it worth a test rather
 * than a code review: a UK browser gives the same answer as the UK default, so
 * the bug renders correctly on the machine of whoever writes it and wrongly on
 * a laptop configured for Germany. The German cases below are the ones that
 * would have caught it.
 *
 * The en-GB cases are the other half of the argument. 302 call sites moved in
 * one sweep, and the reason that was safe is that at the app's default the
 * bytes do not change — asserted here against the exact expressions the sweep
 * replaced, rather than assumed.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { formatCount, compareText, compareNames, forgetCachedFormatters } from '../localeFormat';
import { setUserLocale, forgetCachedLocale } from '../dateFormatter';

describe('counts and sorting in the chosen region', () => {
  beforeEach(() => {
    localStorage.clear();
    forgetCachedLocale();
    forgetCachedFormatters();
  });

  describe('when nothing has been chosen', () => {
    it('groups thousands the UK way', () => {
      expect(formatCount(1234567)).toBe('1,234,567');
      expect(formatCount(1000)).toBe('1,000');
      expect(formatCount(999)).toBe('999');
    });

    it('still prints a zero — the decision to render nothing belongs upstairs', () => {
      // "Zero counts render nothing" is a rule about what a panel shows, not
      // about what a formatter returns. A formatter that swallowed its input
      // would take that decision away from the component making it.
      expect(formatCount(0)).toBe('0');
    });

    it('is not money, and does not pretend to be', () => {
      // formatCurrency owns the symbol, the currency code and the sign rules.
      expect(formatCount(1234)).not.toContain('£');
      expect(formatCount(1234)).not.toContain('$');
    });

    it.each([0, 1, 999, 1000, 1234, 1234567, -42, -1234567, 0.5, 1234.5678])(
      'prints %p exactly as the call it replaced did',
      value => {
        // The sweep's safety claim, asserted: every bare `n.toLocaleString()`
        // became `formatCount(n)`, and at the default that is the same string.
        expect(formatCount(value)).toBe(value.toLocaleString('en-GB'));
      }
    );
  });

  describe('when a region has been chosen', () => {
    it('follows it — the whole point of the setting', () => {
      setUserLocale('de-DE');
      // A German region separates thousands with a dot. A bare
      // `toLocaleString()` would have answered with the BROWSER's locale here
      // and printed 1,234,567 regardless of the setting.
      expect(formatCount(1234567)).toBe('1.234.567');
    });

    it('notices a change without being told to forget anything', () => {
      expect(formatCount(1234567)).toBe('1,234,567');
      setUserLocale('de-DE');
      // The formatter is cached per locale precisely so 5,000 rows do not
      // rebuild it. Caching it per PROCESS would have pinned the app to
      // whatever region happened to be current when the first count rendered.
      expect(formatCount(1234567)).toBe('1.234.567');
      setUserLocale('en-GB');
      expect(formatCount(1234567)).toBe('1,234,567');
    });
  });

  describe('sorting', () => {
    it('orders text the way the region orders it', () => {
      expect(compareText('apple', 'banana')).toBeLessThan(0);
      expect(compareText('banana', 'apple')).toBeGreaterThan(0);
      expect(compareText('apple', 'apple')).toBe(0);
    });

    it('agrees with the localeCompare calls it replaced', () => {
      const words = ['apple', 'Apple', 'ápple', 'banana', 'Bob', 'bob', '', 'Zoe', 'zoe', 'Ärger'];
      for (const a of words) {
        for (const b of words) {
          expect(Math.sign(compareText(a, b))).toBe(Math.sign(a.localeCompare(b, 'en-GB')));
          expect(Math.sign(compareNames(a, b))).toBe(
            Math.sign(a.localeCompare(b, 'en-GB', { sensitivity: 'base' }))
          );
        }
      }
    });

    it('files names by their letters, not by their capitals', () => {
      // The reason thirty sites asked for `sensitivity: 'base'`: a payee list
      // that puts "Tesco" above "acme" because capitals sort first looks broken
      // to the person who typed both.
      expect(compareNames('acme', 'Tesco')).toBeLessThan(0);
      expect(compareNames('Acme', 'acme')).toBe(0);
      expect(compareNames('cafe', 'café')).toBe(0);
    });

    it('sorts a list of payees the way a reader would expect', () => {
      const payees = ['Zara', 'acme Ltd', 'British Gas', 'aldi'];
      expect([...payees].sort(compareNames)).toEqual(['acme Ltd', 'aldi', 'British Gas', 'Zara']);
    });
  });
});
