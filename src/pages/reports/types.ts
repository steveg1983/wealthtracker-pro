import type { UsePeriodResult } from '../../hooks/usePeriod';

/**
 * What the hub hands every report: the shared reporting period.
 *
 * Kept in its own module so a report view never has to import the registry
 * that lazy-loads it (which would put a cycle in the chunk graph).
 */
export interface ReportViewProps {
  picker: UsePeriodResult;
  /**
   * The one point a drill-down arrived pointing at, as a token only this report
   * understands — a YYYY-MM month, a category id, a YYYY-MM-DD date. Null for
   * an ordinary arrival, which means the whole report.
   *
   * The hub reads it from the URL, hands it over and takes it out of the
   * address bar (see utils/reportDrillLink); what to DO about it belongs to the
   * report, because only the report knows whether its answer to "this point" is
   * a row or a dialog. See hooks/useArrivalFocus for the two shapes.
   */
  focus?: string | null;
}
