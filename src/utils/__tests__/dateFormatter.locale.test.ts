/**
 * THE LOCALE SETTING REACHES THE DATES.
 *
 * The owner asked whether the whole system could move from English (GB) to
 * English (US) on a user preference. It could not. Settings ▸ Locale & Date
 * Format offered eight regions, stored the choice, and displayed the chosen
 * pattern back — while every formatter used a hard-coded `const locale =
 * 'en-GB'` and `getDateFormatPlaceholder` returned the literal 'dd/mm/yyyy'.
 *
 * Picking "English (United States)" therefore made the settings card say
 * **mm/dd/yyyy · 12/31/2024** while every date in the app read 31/12/2024. That
 * is a specific, checkable, false statement the app made about itself — worse
 * than the dead Goal Celebrations toggle, which at least only did nothing.
 *
 * The default stays en-GB on purpose. `getUserLocale` used to WRITE the
 * browser's locale into preferences as a side effect of being read, so existing
 * accounts may hold a value nobody chose; honouring that blindly would change
 * how dates read for people who never asked. Only an explicit choice moves it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatDate,
  formatShortDate,
  getDateFormatPlaceholder,
  getDateLocale,
  getMonthNames,
  isUKDateFormat,
  setUserLocale,
  forgetCachedLocale
} from '../dateFormatter';

const CHRISTMAS_EVE = new Date(2024, 11, 24);

describe('the chosen locale', () => {
  beforeEach(() => {
    localStorage.clear();
    forgetCachedLocale();
  });

  describe('when nothing has been chosen', () => {
    it('is en-GB, not whatever the browser happens to be', () => {
      // The app is UK-positioned and says so. Reading the browser here is what
      // would surprise somebody who never opened the setting.
      expect(getDateLocale()).toBe('en-GB');
      expect(getDateFormatPlaceholder()).toBe('dd/mm/yyyy');
      expect(isUKDateFormat()).toBe(true);
    });

    it('puts the day first', () => {
      expect(formatShortDate(CHRISTMAS_EVE)).toContain('24');
      expect(formatShortDate(CHRISTMAS_EVE).indexOf('24')).toBeLessThan(
        formatShortDate(CHRISTMAS_EVE).indexOf('12')
      );
    });
  });

  describe('when the United States is chosen', () => {
    beforeEach(() => { setUserLocale('en-US'); });

    it('moves the month in front of the day', () => {
      const short = formatShortDate(CHRISTMAS_EVE);
      expect(short.indexOf('12')).toBeLessThan(short.indexOf('24'));
    });

    it('says so in the input placeholder, which used to be a fixed string', () => {
      expect(getDateFormatPlaceholder()).toBe('mm/dd/yyyy');
    });

    it('stops claiming the UK order', () => {
      expect(isUKDateFormat()).toBe(false);
    });

    it('reaches formatDate as well, not only formatShortDate', () => {
      // The two had SEPARATE hard-coded locales, and formatShortDate did not
      // even have one — it assembled the order by hand — so fixing one and not
      // the other was an available half-fix. Asserted on ORDER rather than on
      // a month name: formatDate's default options are numeric.
      const formatted = formatDate(CHRISTMAS_EVE);
      expect(formatted.indexOf('12')).toBeLessThan(formatted.indexOf('24'));
    });
  });

  describe('other regions the selector offers', () => {
    it('gives Canada its year-first order', () => {
      setUserLocale('en-CA');
      expect(getDateFormatPlaceholder()).toBe('yyyy-mm-dd');
    });

    it('keeps Australia and Ireland day-first', () => {
      setUserLocale('en-AU');
      expect(isUKDateFormat()).toBe(true);
      forgetCachedLocale();
      setUserLocale('en-IE');
      expect(isUKDateFormat()).toBe(true);
    });
  });

  describe('the cache', () => {
    it('notices a change immediately rather than at the next reload', () => {
      expect(getDateLocale()).toBe('en-GB');
      setUserLocale('en-US');
      // The cache exists because a register renders thousands of dates; it must
      // not turn "changed the setting" into "restart the app".
      expect(getDateLocale()).toBe('en-US');
    });
  });

  describe('month names', () => {
    it('follow the locale as well, since a chart axis is a date too', () => {
      setUserLocale('en-GB');
      expect(getMonthNames('short')[0]).toBe('Jan');
    });
  });

  describe('a locale the browser cannot honour', () => {
    it('falls back rather than throwing', () => {
      // Intl throws RangeError on a malformed tag. A stored preference is user
      // input by another name, and a bad one must not take the app down.
      setUserLocale('not a locale');
      expect(() => getDateFormatPlaceholder()).not.toThrow();
      expect(getDateFormatPlaceholder()).toBe('dd/mm/yyyy');
      expect(isUKDateFormat()).toBe(true);
    });
  });
});
