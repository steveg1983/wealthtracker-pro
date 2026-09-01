import { useMemo } from 'react';
import { getDateLocale } from '../utils/dateFormatter';

/**
 * The date on a phone card, in the region the reader chose.
 *
 * ─ WHY THERE IS NO LONGER A `locale` PARAMETER ─────────────────────────────
 *
 * There was one, and it defaulted to `'en-US'`. Every caller took the default
 * — the register's card calls `useFormattedDate(transaction.date)` and nothing
 * else in the app calls this at all — so a user with Settings ▸ App ▸ Region &
 * Date Format set to English (UK) read "Jun 2, 2026" on her phone register
 * while the same transaction read "2 Jun 2026" on the desktop one (reported
 * 1 Sep 2026). The setting was not being overridden; it was never asked.
 *
 * A parameter with a default is an invitation to ship that bug again, and
 * nobody has ever wanted to render one date in a region the reader did not
 * choose. So the setting is the only answer: `getDateLocale()` returns the
 * EXPLICIT choice, and en-GB when there is none (see utils/dateFormatter).
 *
 * ─ WHY THE CACHE, AND WHY THE LOCALE IS IN ITS KEY ─────────────────────────
 *
 * An account register puts thousands of dates on one page, and `Intl` is the
 * expensive part of drawing one. The key carries the locale because changing
 * the setting must not mean restarting the app — the same instant that
 * `getDateLocale` starts answering differently, every key it was asked under
 * before stops being reachable.
 */
const dateCache = new Map<string, string>();

export function useFormattedDate(date: Date | string): string {
  const locale = getDateLocale();
  return useMemo(() => {
    const dateKey = `${date.toString()}_${locale}`;

    if (dateCache.has(dateKey)) {
      return dateCache.get(dateKey)!;
    }

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const formatted = dateObj.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    // Limit cache size to prevent memory issues
    if (dateCache.size > 1000) {
      const firstKey = dateCache.keys().next().value;
      if (firstKey) {
        dateCache.delete(firstKey);
      }
    }

    dateCache.set(dateKey, formatted);
    return formatted;
  }, [date, locale]);
}
