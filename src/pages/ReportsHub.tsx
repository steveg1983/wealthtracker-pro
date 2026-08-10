import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, CalendarIcon } from '../components/icons';
import PageTip from '../components/PageTip';
import PageWrapper from '../components/PageWrapper';
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

  /**
   * The page's anatomy is the app's anatomy, deliberately.
   *
   * This header used to be a full-bleed white bar clamped to the top of the
   * window — negative margins to escape the layout's padding, a border under
   * it, the heading and the period control inside it. Every other page in the
   * app (Accounts, Budget, Categories, Transactions, Settings) says its name in
   * a plain heading and then stacks content cards under it, so Reports read as
   * a different application to the one the user was in a click ago.
   *
   * It now uses the same PageWrapper as those pages — the identical h1, the
   * identical spacing — and the period control moved into a card of its own,
   * because that is what it is: a control, not part of the page's title. The
   * back-link sits above the heading, where the register's does.
   */
  return (
    <>
      {report && (
        <Link
          to={provenance ? provenance.path : preserveDemoParam('/reports', location.search)}
          state={provenance ? returnState(provenance) : undefined}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors mb-3"
        >
          <ArrowLeftIcon size={16} />
          {provenance ? provenance.label : 'All reports'}
        </Link>
      )}

      <PageWrapper
        title={report ? report.title : 'Reports'}
        headerContent={
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {report
              ? report.description
              : 'Choose a report. The period you pick follows you from one to the next.'}
          </p>
        }
        contentClassName="space-y-6"
      >
        {(report?.usesPeriod ?? true) && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 flex items-center gap-2">
            <CalendarIcon className="text-gray-500 flex-shrink-0" size={18} />
            {/* Named for a screen reader even though it is the only period
                control on the page: out of the header it is no longer read
                straight after the report's title, so it has to say what it
                governs on its own. */}
            <PeriodPicker picker={picker} label="Reporting period" />
          </div>
        )}

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
      </PageWrapper>
    </>
  );
}
