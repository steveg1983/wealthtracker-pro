import { PERIOD_LABELS, type PeriodKey } from '../hooks/usePeriod';
import { carryDemoFlag } from './navigation';

/**
 * The link a chart drills through on: which report, over WHICH PERIOD, and
 * which point on it.
 *
 * The problem this solves: the Dashboard's report cards each sit under their
 * own period control, and clicking one used to throw that away — a card read
 * over "This month" opened a report showing all time, and the figure the user
 * had just clicked was nowhere on the screen. The period travels with the
 * click, in the URL.
 *
 * WHY THE URL AND NOT location.state, when provenance uses state: a period is
 * about the DESTINATION, not the journey. It is exactly the thing a user wants
 * when they copy the link, bookmark it or reload the page, and it is meaningful
 * to anyone who opens it. Provenance ("Back to Dashboard") is the opposite on
 * every count — see navigationProvenance.
 *
 * The params are consumed ONCE, on arrival (see ReportsHub): they set the
 * period for the visit and are then stripped from the URL, so the picker is
 * back in charge and the report's own stored period is left exactly as the user
 * last set it. A drill-down is a look at something, not a change of mind.
 */

export const REPORT_PERIOD_PARAM = 'period';
export const REPORT_PERIOD_START_PARAM = 'periodFrom';
export const REPORT_PERIOD_END_PARAM = 'periodTo';
export const REPORT_FOCUS_PARAM = 'focus';

const ARRIVAL_PARAMS = [
  REPORT_PERIOD_PARAM,
  REPORT_PERIOD_START_PARAM,
  REPORT_PERIOD_END_PARAM,
  REPORT_FOCUS_PARAM,
] as const;

/**
 * A period as it travels: the key, plus the bounds that only mean anything
 * when the key is `custom`.
 *
 * Structurally satisfied by `UsePeriodResult`, so any surface holding a picker
 * can hand it straight over without unpacking it first.
 */
export interface CarriedPeriod {
  period: PeriodKey;
  customStart: string;
  customEnd: string;
}

/** Storage and URLs hold whatever an older build (or a person) put there. */
const isPeriodKey = (value: string): value is PeriodKey => value in PERIOD_LABELS;

export interface ReportDrillOptions {
  /**
   * The window the chart was read over. Omitted for a report that has no
   * period of its own (account distribution is a snapshot of today) — sending
   * one would silently move the period the NEXT report opens on.
   */
  period?: CarriedPeriod | null;
  /**
   * The point that was clicked, as a token only the destination report
   * understands: a YYYY-MM month, a category id, a YYYY-MM-DD date. Absent
   * for a click on the card's header, which means "the whole thing".
   */
  focus?: string | null;
  /** The current location's search, so a demo session stays a demo session. */
  currentSearch: string;
}

/** `/reports/<id>` carrying the period the chart was read over. */
export function buildReportDrillPath(reportId: string, options: ReportDrillOptions): string {
  const params = new URLSearchParams();
  const { period } = options;
  if (period) {
    params.set(REPORT_PERIOD_PARAM, period.period);
    // Bounds only travel with the key they belong to: a stale start date
    // attached to "This month" would be read as a custom window by nobody, and
    // is noise in a link people are meant to be able to read.
    if (period.period === 'custom') {
      if (period.customStart) params.set(REPORT_PERIOD_START_PARAM, period.customStart);
      if (period.customEnd) params.set(REPORT_PERIOD_END_PARAM, period.customEnd);
    }
  }
  if (options.focus) params.set(REPORT_FOCUS_PARAM, options.focus);

  const query = params.toString();
  return carryDemoFlag(`/reports/${reportId}${query ? `?${query}` : ''}`, options.currentSearch);
}

export interface ReportArrival {
  /** Null when this is an ordinary arrival with no period asked for. */
  period: PeriodKey | null;
  customStart: string;
  customEnd: string;
  /** Null when the whole report was asked for rather than one point on it. */
  focus: string | null;
}

/** What a report page was asked for on arrival. */
export function readReportArrival(search: string): ReportArrival {
  const params = new URLSearchParams(search);
  const raw = params.get(REPORT_PERIOD_PARAM);
  return {
    // An unreadable key (a typo, a period this build no longer has) is treated
    // as no period at all: the page opens on its own window rather than on
    // nothing.
    period: raw !== null && isPeriodKey(raw) ? raw : null,
    customStart: params.get(REPORT_PERIOD_START_PARAM) ?? '',
    customEnd: params.get(REPORT_PERIOD_END_PARAM) ?? '',
    focus: params.get(REPORT_FOCUS_PARAM),
  };
}

/** True when there is anything here for the page to consume. */
export function hasReportArrival(arrival: ReportArrival): boolean {
  return arrival.period !== null || arrival.focus !== null;
}

/**
 * The same search with the arrival params taken out, ready for the replace that
 * consumes them. Everything else in the query string — the demo flag above all
 * — is left exactly where it was.
 */
export function stripReportArrival(search: string): string {
  const params = new URLSearchParams(search);
  for (const param of ARRIVAL_PARAMS) params.delete(param);
  const query = params.toString();
  return query ? `?${query}` : '';
}
