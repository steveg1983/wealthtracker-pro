import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, CalendarIcon } from '../components/icons';
import PageTip from '../components/PageTip';
import PeriodPicker from '../components/PeriodPicker';
import { SkeletonCard } from '../components/loading/Skeleton';
import { usePeriod, type PeriodKey } from '../hooks/usePeriod';
import { preserveDemoParam } from '../utils/navigation';
import { readProvenance, returnState } from '../utils/navigationProvenance';
import { hasReportArrival, readReportArrival, stripReportArrival } from '../utils/reportDrillLink';
import ReportGallery from './reports/ReportGallery';
import { findReport } from './reports/reportRegistry';

/** The window a report gets when it states no preference of its own. */
const HUB_DEFAULT_PERIOD: PeriodKey = 'this-month';

/**
 * The reports hub — a gallery of named reports (Microsoft Money's model)
 * rather than a row of tabs, which stops scaling the moment there is more
 * than a handful of reports.
 *
 * The hub owns the shared reporting period and hands it to whichever report
 * is open, so the period PERSISTS as the user moves between reports instead
 * of resetting each time. Each report lives at its own /reports/<id> URL and
 * is code-split, so opening the gallery never loads eight reports' worth of
 * charts.
 *
 * Until the user picks a period, each report opens on the window it is worth
 * reading over (net worth over time on ALL of it, not this month). The moment
 * they pick one, that choice wins everywhere and is never overridden.
 */
export default function ReportsHub(): React.JSX.Element {
  const { reportId } = useParams<{ reportId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const report = findReport(reportId);
  const preferredPeriod = report?.defaultPeriod ?? HUB_DEFAULT_PERIOD;

  // One period for the whole hub (storage key shared with the Dashboard's
  // pinned reports, so the two agree about the window as well). The report's
  // preference seeds it on the first paint...
  const picker = usePeriod('reportsPeriod', preferredPeriod);
  const { applyDefaultPeriod, applyArrivalPeriod } = picker;

  // ...and takes effect again when a different report opens without the hub
  // remounting. Both are no-ops once the user has chosen for themselves, or
  // once a drill-down has arrived carrying its own window.
  useEffect(() => {
    applyDefaultPeriod(preferredPeriod);
  }, [applyDefaultPeriod, preferredPeriod]);

  /**
   * What a drill-down from the Dashboard arrived asking for: the window the
   * chart it was clicked on was read over, and the point on it.
   *
   * Consumed ONCE and then taken out of the URL, which is what keeps this from
   * fighting the picker: after the replace the address bar says only which
   * report is open, the user's next click on the period control means what it
   * has always meant, and a reload does not drag them back to the window they
   * arrived on. The report's own stored period is never written to (see
   * applyArrivalPeriod).
   */
  const [focused, setFocused] = useState<{ reportId: string; token: string } | null>(null);
  const arrival = useMemo(() => readReportArrival(location.search), [location.search]);
  useEffect(() => {
    if (!hasReportArrival(arrival) || report === null) return;
    // A report with no period of its own (account distribution is a snapshot of
    // today) is handed none: applying it would silently move the window the
    // NEXT report opens on, from a control this page does not even show.
    if (arrival.period !== null && report.usesPeriod) {
      applyArrivalPeriod(arrival.period, arrival.customStart, arrival.customEnd);
    }
    if (arrival.focus !== null) setFocused({ reportId: report.id, token: arrival.focus });
    // state is carried across the replace by hand: React Router starts a new
    // history entry with null state otherwise, and the provenance that entry is
    // holding is the only thing that knows the way back.
    navigate(
      { pathname: location.pathname, search: stripReportArrival(location.search) },
      { replace: true, state: location.state }
    );
  }, [arrival, report, applyArrivalPeriod, navigate, location.pathname, location.search, location.state]);

  // A point only belongs to the report it was clicked into. Opening another
  // report from the gallery leaves it behind rather than highlighting whatever
  // happens to share the token over there.
  const focus = focused !== null && focused.reportId === reportId ? focused.token : null;

  /**
   * Where the user came from, if they came from somewhere that said so — the
   * Dashboard's cards do. Absent on a bookmark, a typed URL or the gallery,
   * and then the back-link is the hub's own, exactly as before.
   */
  const provenance = readProvenance(location.state);

  // An unknown id (an old bookmark, a typo) returns to the gallery rather
  // than showing an empty frame.
  if (reportId !== undefined && report === null) {
    return <Navigate to={preserveDemoParam('/reports', location.search)} replace />;
  }

  const ReportView = report?.component;

  return (
    <div className="space-y-0">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 -mx-4 md:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 lg:-mt-8 mb-6">
        <div className="max-w-[1400px] mx-auto py-4 px-4 md:px-0">
          {report && (
            <Link
              to={provenance ? provenance.path : preserveDemoParam('/reports', location.search)}
              state={provenance ? returnState(provenance) : undefined}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors mb-2"
            >
              <ArrowLeftIcon size={16} />
              {provenance ? provenance.label : 'All reports'}
            </Link>
          )}

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {report ? report.title : 'Reports'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {report
                  ? report.description
                  : 'Choose a report. The period you pick follows you from one to the next.'}
              </p>
            </div>

            {(report?.usesPeriod ?? true) && (
              <div className="flex items-center gap-2">
                <CalendarIcon className="text-gray-500 flex-shrink-0" size={18} />
                <PeriodPicker picker={picker} />
              </div>
            )}
          </div>
        </div>
      </div>

      {ReportView ? (
        <Suspense fallback={<SkeletonCard className="h-96" />}>
          <ReportView picker={picker} focus={focus} />
        </Suspense>
      ) : (
        <ReportGallery />
      )}

      {/* One tip per page is the pattern, so the gallery's tip also carries the
          rule people otherwise read as missing money. id bumped from
          `reports-gallery` because that second half is new. */}
      <PageTip
        id="reports-gallery-2"
        title="Reports, and what they leave out"
        description="Pick a report — net worth, balances, spending by category or payee, period comparisons — and the period you choose follows you from one to the next. A transaction with no category is left out of income and expense totals altogether, so nothing is counted under the wrong heading; the amber band on each report lists those rows for filing."
      />
    </div>
  );
}
