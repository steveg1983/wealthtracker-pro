/**
 * Date formatting utilities with locale detection
 * Automatically detects user's locale and formats dates accordingly
 */
import { preferences } from '../services/preferencesService';

/**
 * ─ THE LOCALE, AND WHY IT NOW REACHES ANYTHING ─────────────────────────────
 *
 * Settings ▸ Locale & Date Format offered eight regions, stored the choice, and
 * showed the chosen format back to the reader — while every formatter below it
 * used a hard-coded `const locale = 'en-GB'`, and `getDateFormatPlaceholder`
 * returned the literal string 'dd/mm/yyyy'.
 *
 * So picking "English (United States)" made the settings card say
 * **mm/dd/yyyy · 12/31/2024** and left every date in the app reading
 * 31/12/2024. That is worse than the dead Goal Celebrations toggle: a dead
 * toggle accepts input and reports a state, but this one made a specific,
 * checkable, FALSE statement about how the app would behave.
 *
 * ─ THE DEFAULT IS STILL en-GB, DELIBERATELY ────────────────────────────────
 *
 * `getUserLocale` reads the browser and, until today, WROTE that value into
 * preferences as a side effect of being read. So existing accounts may hold a
 * `preferredLocale` nobody ever chose. Honouring that blindly would have
 * changed how dates read for people who never asked for a change, which is not
 * a locale feature — it is a surprise.
 *
 * `getDateLocale` therefore answers with the EXPLICIT choice, and en-GB when
 * there is none. The app is UK-positioned and states so; the selector is what
 * moves it, and nothing else.
 */
const DEFAULT_LOCALE = 'en-GB';
const LOCALE_KEY = 'preferredLocale';

/**
 * Cached because this is called once per rendered date, and a register can put
 * five thousand on a page. Invalidated by `setUserLocale`, which is the only
 * thing that can change the answer.
 */
let cachedLocale: string | null = null;

/** The locale the user actually chose, or the app's default. */
export function getDateLocale(): string {
  if (cachedLocale !== null) return cachedLocale;
  const stored = preferences.getItem(LOCALE_KEY);
  cachedLocale = stored !== null && stored !== '' ? stored : DEFAULT_LOCALE;
  return cachedLocale;
}

/**
 * What the browser says, for the settings card to offer as a starting point.
 * No longer writes what it read — a getter with a side effect is how accounts
 * ended up holding a preference nobody set.
 */
export function getUserLocale(): string {
  const stored = preferences.getItem(LOCALE_KEY);
  if (stored !== null && stored !== '') return stored;
  return navigator.language || (navigator.languages && navigator.languages[0]) || DEFAULT_LOCALE;
}

// Set user's preferred locale
export function setUserLocale(locale: string): void {
  preferences.setItem(LOCALE_KEY, locale);
  cachedLocale = locale;
}

/** For tests, and for a restore that rewrites preferences underneath us. */
export function forgetCachedLocale(): void {
  cachedLocale = null;
}

/**
 * Does the chosen locale put the day first?
 *
 * Returned `true` unconditionally, which was the honest thing to write while
 * every formatter was pinned to en-GB and a lie the moment they stopped being.
 * Derived from the locale itself rather than from a list of countries, so a
 * region nobody thought of still gets the right answer.
 */
export function isUKDateFormat(): boolean {
  return dayComesFirst(getDateLocale());
}

/** Whether `locale` orders a numeric date day-then-month. */
function dayComesFirst(locale: string): boolean {
  try {
    const parts = new Intl.DateTimeFormat(locale).formatToParts(new Date(2024, 11, 31));
    const day = parts.findIndex((part) => part.type === 'day');
    const month = parts.findIndex((part) => part.type === 'month');
    return day !== -1 && month !== -1 && day < month;
  } catch {
    return true;
  }
}

// Format date according to user's locale (always UK format for consistency)
export function formatDate(date: Date | string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  
  const locale = getDateLocale();
  
  // Default options if none provided
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  
  return dateObj.toLocaleDateString(locale, options || defaultOptions);
}

/**
 * The app's most-used date format — and the one that could never have followed
 * a locale, because it did not ask one.
 *
 * It assembled `${day}/${month}/${year}` by hand. Every other formatter here
 * had a hard-coded `'en-GB'` that could at least be swapped for a lookup; this
 * one had the ORDER built into the string, so no amount of fixing the locale
 * elsewhere would have moved it. Zero-padded two-digit parts, through Intl,
 * which gives dd/mm/yyyy for en-GB exactly as before.
 */
export function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';

  try {
    return dateObj.toLocaleDateString(getDateLocale(), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}/${dateObj.getFullYear()}`;
  }
}

// Format date for input fields (always yyyy-mm-dd for HTML date inputs)
export function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  
  const year = dateObj.getFullYear();
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getDate().toString().padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

// Parse date from various formats
export function parseDate(dateString: string): Date | null {
  if (!dateString) return null;
  
  // Handle ISO format (yyyy-mm-dd)
  if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) return date;
  }
  
  // Handle UK format (dd/mm/yyyy) - always parse as UK format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
    const parts = dateString.split('/');
    // Always parse as dd/mm/yyyy for UK market
    const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    if (!isNaN(date.getTime())) return date;
  }
  
  // Try native Date parsing as fallback
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

// Format date with time
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  
  const locale = getDateLocale();
  
  return dateObj.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * A wall-clock time on its own — "14:02".
 *
 * ─ WHY IT EXISTS (owner's ruling, 4 Sep 2026: "standardise them") ──────────
 *
 * The locale sweep of 2 Sep routed every date and time through the Region
 * setting, but deliberately left eleven sites on their EXACT old shape: a
 * `toLocaleTimeString(locale)` with no options prints SECONDS, and changing a
 * shape is a design call rather than a locale fix. Four other places had
 * already written `{ hour: '2-digit', minute: '2-digit' }` out by hand to
 * avoid exactly that — a house shape with no house function, which is the
 * state a formatter module exists to prevent.
 *
 * The owner has now made the call: the app has ONE date-time shape, and this
 * is its time half. `formatDateTime` is the whole of it.
 *
 * ─ NO SECONDS, AND THAT IS THE POINT ──────────────────────────────────────
 *
 * Nothing the app times is measured to a second. "Last synced at 14:02:37"
 * offers a precision the number does not have, and on a clock that only
 * re-renders when something happens the seconds field is stale the instant it
 * is drawn — it invites a reader to trust a digit that is already wrong.
 *
 * ─ TWENTY-FOUR HOUR BY LOCALE, NOT BY FORCE ───────────────────────────────
 *
 * `hour12` is left unset on purpose, so en-GB gives 14:02 and a region that
 * reads 2:02 pm gets that. The setting is the one answer here as everywhere
 * else in this file.
 */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';

  return dateObj.toLocaleTimeString(getDateLocale(), {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Format relative date (e.g., "2 days ago", "in 3 weeks")
export function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  
  const now = new Date();
  const diffInMs = now.getTime() - dateObj.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) {
    return 'Today';
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays === -1) {
    return 'Tomorrow';
  } else if (diffInDays > 0 && diffInDays < 7) {
    return `${diffInDays} days ago`;
  } else if (diffInDays < 0 && diffInDays > -7) {
    return `in ${Math.abs(diffInDays)} days`;
  } else if (diffInDays >= 7 && diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else if (diffInDays <= -7 && diffInDays > -30) {
    const weeks = Math.floor(Math.abs(diffInDays) / 7);
    return `in ${weeks} week${weeks > 1 ? 's' : ''}`;
  } else {
    return formatShortDate(dateObj);
  }
}

/**
 * The pattern to show beside a date input, in the chosen locale's order.
 *
 * Returned the literal 'dd/mm/yyyy' regardless — so the settings card could
 * show "mm/dd/yyyy" for the United States while every input in the app still
 * told the reader to type the day first. Asked of Intl rather than looked up,
 * for the same reason as `dayComesFirst`.
 */
export function getDateFormatPlaceholder(): string {
  const locale = getDateLocale();
  try {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
      .formatToParts(new Date(2024, 11, 31))
      .map((part) => {
        if (part.type === 'day') return 'dd';
        if (part.type === 'month') return 'mm';
        if (part.type === 'year') return 'yyyy';
        return part.value;
      })
      .join('');
  } catch {
    return 'dd/mm/yyyy';
  }
}

// Get month names in user's locale (UK format)
export function getMonthNames(format: 'long' | 'short' = 'long'): string[] {
  const locale = getDateLocale();
  const months: string[] = [];
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(2024, i, 1);
    months.push(date.toLocaleDateString(locale, { month: format }));
  }
  
  return months;
}

// Get day names in user's locale (UK format)
export function getDayNames(format: 'long' | 'short' | 'narrow' = 'long'): string[] {
  const locale = getDateLocale();
  const days: string[] = [];
  
  // Start with Sunday (0) to Saturday (6)
  for (let i = 0; i < 7; i++) {
    const date = new Date(2024, 0, i + 7); // January 7-13, 2024 (Sunday-Saturday)
    days.push(date.toLocaleDateString(locale, { weekday: format }));
  }
  
  return days;
}