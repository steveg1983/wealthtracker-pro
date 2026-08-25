import { preferences } from '../services/preferencesService';
import { isPeriodKey, type PeriodKey } from '../hooks/usePeriod';

/**
 * EACH REPORT'S OWN DEFAULT WINDOW (owner, 25 Aug).
 *
 * ─ THE COMPLAINT ──────────────────────────────────────────────────────────
 *
 * "On the report last page, we have the length of time options which on the
 * front report page doesn't change anything." It did change something — it
 * set the window the next report would open on — but nothing on the gallery
 * moves when you press it, and a control with no visible effect reads as
 * broken. The picker now appears only where its effect is visible: on a
 * report.
 *
 * ─ WHY A SAVED DEFAULT RATHER THAN JUST REMEMBERING ───────────────────────
 *
 * Different reports want different windows — net worth over ALL of it,
 * spending over last month — and one shared period makes you re-pick on every
 * navigation. The obvious fix is to have each report silently remember what
 * you last used, but that costs something real: you could no longer LOOK at
 * twelve months without changing what the report opens on tomorrow.
 *
 * So the owner's design is the right one: changing the window is a look, and
 * saving is a decision. "If they change the length, the button unticks itself
 * and the user has to press it again to update the default."
 *
 * ─ WHY THE TICK IS DERIVED, NEVER STORED ──────────────────────────────────
 *
 * The control is ticked exactly when the saved default EQUALS what is on
 * screen. Nothing tracks "ticked" separately, so the unticking he described
 * is not a behaviour anyone had to implement — it is the same comparison,
 * and it cannot drift out of step with the thing it claims to describe.
 *
 * ─ WHAT IT DOES NOT CHANGE ────────────────────────────────────────────────
 *
 * A report with no saved default behaves exactly as before: it opens on the
 * shared reporting period, so the window still follows you from one report to
 * the next. This is additive — nobody loses the old behaviour by not using
 * the new one.
 *
 * Kept in `preferences` rather than localStorage for the reason usePeriod
 * gives: which window a report opens on belongs to the USER, not to the
 * machine they happen to be sitting at.
 */

const storageKey = (reportId: string): string => `reportDefaultPeriod:${reportId}`;
const customKey = (reportId: string): string => `reportDefaultPeriodCustom:${reportId}`;

/** A saved default's full selection — custom carries its own bounds. */
export interface ReportPeriodDefault {
  period: PeriodKey;
  customStart: string;
  customEnd: string;
}

export function readReportPeriodDefault(reportId: string): ReportPeriodDefault | null {
  const stored = preferences.getItem(storageKey(reportId));
  if (stored === null || !isPeriodKey(stored)) return null;
  if (stored !== 'custom') return { period: stored, customStart: '', customEnd: '' };

  // A custom window is meaningless without its bounds; a half-saved one is
  // treated as no default rather than as "custom, from nowhere to nowhere".
  const bounds = preferences.getItem(customKey(reportId));
  if (bounds === null) return null;
  const [customStart = '', customEnd = ''] = bounds.split('..');
  if (!customStart && !customEnd) return null;
  return { period: 'custom', customStart, customEnd };
}

export function writeReportPeriodDefault(
  reportId: string,
  selection: ReportPeriodDefault
): void {
  preferences.setItem(storageKey(reportId), selection.period);
  if (selection.period === 'custom') {
    preferences.setItem(customKey(reportId), `${selection.customStart}..${selection.customEnd}`);
  } else {
    preferences.removeItem(customKey(reportId));
  }
}

export function clearReportPeriodDefault(reportId: string): void {
  preferences.removeItem(storageKey(reportId));
  preferences.removeItem(customKey(reportId));
}

/**
 * Is what is on screen the saved default? The whole of the tick's behaviour.
 *
 * Custom compares its BOUNDS too: two custom windows over different dates are
 * different answers to "what should this report open on", and a tick that
 * ignored them would claim a date range had been saved when another one had.
 */
export function matchesReportPeriodDefault(
  saved: ReportPeriodDefault | null,
  current: { period: PeriodKey; customStart: string; customEnd: string }
): boolean {
  if (saved === null) return false;
  if (saved.period !== current.period) return false;
  if (saved.period !== 'custom') return true;
  return saved.customStart === current.customStart && saved.customEnd === current.customEnd;
}
