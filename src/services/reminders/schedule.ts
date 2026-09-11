/**
 * The balance reminder's arithmetic, in any time zone.
 *
 * utils/balanceReminders.ts owns the reminder as the BROWSER sees it: the
 * preference, the acknowledgement, the snooze, the card. Its one piece of
 * arithmetic — "what is the most recent scheduled moment at or before now?"
 * — used to be written in local-Date calls, which is right for a page (the
 * page runs where the person is) and useless for a server: the cron that
 * pushes the same reminder to a phone runs in UTC and has to work out what
 * "08:30" means in Manchester, or in Auckland.
 *
 * So the arithmetic lives here, pure, with the zone as an argument, and the
 * browser passes its own. One implementation, two callers, no second copy of
 * the rule to drift — the same reason the sync cores were lifted out of their
 * handlers.
 *
 * No imports, on purpose: api/ reaches this module and a Supabase client in
 * its import graph would be a serverless function that cannot start.
 */

export type ReminderSchedule = 'off' | 'daily' | 'weekly' | 'monthly';

export interface ReminderSchedulePrefs {
  schedule: ReminderSchedule;
  /** 24h "HH:mm". */
  time: string;
  /** 0 (Sunday) – 6 (Saturday); only meaningful in 'weekly'. */
  weekday: number;
  /** 1–28, only meaningful in 'monthly' — see utils/balanceReminders for why 28. */
  monthDay: number;
}

export interface ReminderScheduleState {
  lastAcknowledged: Date | null;
  snoozedUntil: Date | null;
}

export const DEFAULT_REMINDER_SCHEDULE: ReminderSchedulePrefs = {
  schedule: 'off',
  time: '08:30',
  weekday: 1,
  monthDay: 1,
};

/** The two entries in the preferences document. */
export const REMINDER_PREFS_KEY = 'balanceReminders.prefs.v1';
export const REMINDER_STATE_KEY = 'balanceReminders.state.v1';

const isValidTime = (t: unknown): t is string =>
  typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof value === 'number' && Number.isInteger(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
};

/** The stored string (or parsed object) → the schedule; anything unreadable is 'off'. */
export function parseReminderSchedule(raw: unknown): ReminderSchedulePrefs {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return { ...DEFAULT_REMINDER_SCHEDULE };
    }
  }
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_REMINDER_SCHEDULE };
  const parsed = value as Partial<ReminderSchedulePrefs>;
  const schedule = parsed.schedule;
  return {
    schedule:
      schedule === 'daily' || schedule === 'weekly' || schedule === 'monthly'
        ? schedule
        : 'off',
    time: isValidTime(parsed.time) ? parsed.time : DEFAULT_REMINDER_SCHEDULE.time,
    weekday: clampInt(parsed.weekday, 0, 6, DEFAULT_REMINDER_SCHEDULE.weekday),
    monthDay: clampInt(parsed.monthDay, 1, 28, DEFAULT_REMINDER_SCHEDULE.monthDay),
  };
}

/** The stored string → the two dates; anything unreadable is "never". */
export function parseReminderState(raw: unknown): ReminderScheduleState {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return { lastAcknowledged: null, snoozedUntil: null };
    }
  }
  if (typeof value !== 'object' || value === null) return { lastAcknowledged: null, snoozedUntil: null };
  const parsed = value as { lastAcknowledged?: unknown; snoozedUntil?: unknown };
  const date = (candidate: unknown): Date | null => {
    if (typeof candidate !== 'string' || !candidate) return null;
    const d = new Date(candidate);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  return {
    lastAcknowledged: date(parsed.lastAcknowledged),
    snoozedUntil: date(parsed.snoozedUntil),
  };
}

// ── The zone arithmetic ─────────────────────────────────────────────────────

interface WallClock {
  year: number;
  month: number;
  day: number;
  /** 0 (Sunday) – 6 (Saturday). */
  weekday: number;
  hour: number;
  minute: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * No locale is named, on purpose: the parts are read by TYPE, so the order
 * a locale would print them in is irrelevant, and `numberingSystem: 'latn'`
 * keeps the digits Western whatever the host's own locale would use. (The
 * app's rule that no file names a region — localeObeysTheSetting.test.ts —
 * holds here for the same reason it holds everywhere: this is arithmetic,
 * not display.)
 */
const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(undefined, {
      timeZone,
      numberingSystem: 'latn',
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
};

/** What a clock on the wall in `timeZone` reads at `instant`. */
export function wallClockIn(timeZone: string, instant: Date): WallClock {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  const year = read('year');
  const month = read('month');
  const day = read('day');
  return {
    year,
    month,
    day,
    // The weekday of a calendar date is arithmetic, and asking Intl for a
    // name would mean parsing one in some locale's language.
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    // h23 gives "00"–"23"; some engines still answer "24" at midnight.
    hour: read('hour') % 24,
    minute: read('minute'),
  };
}

const asUtc = (clock: Pick<WallClock, 'year' | 'month' | 'day' | 'hour' | 'minute'>): number =>
  Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, 0, 0);

/**
 * The instant at which a wall clock in `timeZone` reads the given time.
 *
 * Two passes: guess the instant as if the zone were UTC, read the zone's
 * offset at that guess, correct, and read once more — the second read is
 * what gets a moment right on the day the clocks change. A time that does
 * not exist in the zone (the skipped hour in spring) lands an hour later,
 * which is what an alarm clock does.
 */
export function instantOfWallClock(
  timeZone: string,
  clock: Pick<WallClock, 'year' | 'month' | 'day' | 'hour' | 'minute'>
): Date {
  const wanted = asUtc(clock);
  let instant = wanted;
  for (let pass = 0; pass < 2; pass += 1) {
    const offset = asUtc(wallClockIn(timeZone, new Date(instant))) - instant;
    instant = wanted - offset;
  }
  return new Date(instant);
}

/** The calendar day `days` after (or before) a wall-clock date, in that zone's calendar. */
const shiftDays = (clock: WallClock, days: number): Pick<WallClock, 'year' | 'month' | 'day'> => {
  const shifted = new Date(Date.UTC(clock.year, clock.month - 1, clock.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
};

/**
 * The most recent scheduled moment at or before `now`, as a clock in
 * `timeZone` would count it, or null when the schedule is off. Pure, and the
 * whole of the arithmetic — everything else is a comparison against this.
 */
export function mostRecentScheduledMomentInZone(
  prefs: ReminderSchedulePrefs,
  now: Date,
  timeZone: string
): Date | null {
  if (prefs.schedule === 'off') return null;
  const time = isValidTime(prefs.time) ? prefs.time : DEFAULT_REMINDER_SCHEDULE.time;
  const [hour, minute] = time.split(':').map(Number);
  const today = wallClockIn(timeZone, now);

  const at = (day: Pick<WallClock, 'year' | 'month' | 'day'>): Date =>
    instantOfWallClock(timeZone, { ...day, hour, minute });

  if (prefs.schedule === 'daily') {
    const candidate = at(today);
    return candidate <= now ? candidate : at(shiftDays(today, -1));
  }

  if (prefs.schedule === 'weekly') {
    const weekday = clampInt(prefs.weekday, 0, 6, DEFAULT_REMINDER_SCHEDULE.weekday);
    const back = (today.weekday - weekday + 7) % 7;
    const candidate = at(shiftDays(today, -back));
    return candidate <= now ? candidate : at(shiftDays(today, -back - 7));
  }

  const monthDay = clampInt(prefs.monthDay, 1, 28, DEFAULT_REMINDER_SCHEDULE.monthDay);
  const thisMonth = at({ year: today.year, month: today.month, day: monthDay });
  if (thisMonth <= now) return thisMonth;
  const previous = today.month === 1
    ? { year: today.year - 1, month: 12, day: monthDay }
    : { year: today.year, month: today.month - 1, day: monthDay };
  return at(previous);
}

/**
 * Is a reminder due at `now`, in `timeZone`?
 *
 * Due when the most recent scheduled moment has passed without an
 * acknowledgement since — which is what makes a closed app catch up on open,
 * and a phone hear about it in between — unless a snooze is still quiet.
 */
export function reminderDueInZone(
  prefs: ReminderSchedulePrefs,
  state: ReminderScheduleState,
  now: Date,
  timeZone: string
): Date | null {
  const scheduled = mostRecentScheduledMomentInZone(prefs, now, timeZone);
  if (scheduled === null) return null;
  if (state.snoozedUntil !== null && now < state.snoozedUntil) return null;
  return state.lastAcknowledged === null || state.lastAcknowledged < scheduled ? scheduled : null;
}

/** The zone this JavaScript is running in — what a browser passes. */
export function hostTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
