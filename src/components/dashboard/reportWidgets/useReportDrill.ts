import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildReportDrillPath, type CarriedPeriod } from '../../../utils/reportDrillLink';
import { currentPageProvenance, withProvenance } from '../../../utils/navigationProvenance';

/**
 * What the Dashboard's report cards do when they are clicked — in one place,
 * because a card that "opens its report like the others" is a card that stops
 * doing so at the first edit.
 *
 * Two things travel with every click, and they travel by different roads for
 * different reasons (see utils/reportDrillLink and utils/navigationProvenance):
 * the PERIOD in the URL, because it belongs to the destination and should
 * survive being bookmarked; the PROVENANCE in history state, because it belongs
 * to the journey and would be a lie in anyone else's hands.
 */

/** What the way back from a report says when the Dashboard sent the user. */
export const DASHBOARD_BACK_LABEL = 'Back to Dashboard';

export type OpenReport = (
  reportId: string,
  options?: { period?: CarriedPeriod | null; focus?: string | null }
) => void;

export function useReportDrill(): OpenReport {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback((reportId, options = {}): void => {
    navigate(
      buildReportDrillPath(reportId, {
        period: options.period ?? null,
        focus: options.focus ?? null,
        currentSearch: location.search,
      }),
      { state: withProvenance(currentPageProvenance(location, DASHBOARD_BACK_LABEL)) }
    );
  }, [navigate, location]);
}
