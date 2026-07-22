import React, { Suspense } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeftIcon, CalendarIcon } from '../components/icons';
import PageTip from '../components/PageTip';
import PeriodPicker from '../components/PeriodPicker';
import { SkeletonCard } from '../components/loading/Skeleton';
import { usePeriod } from '../hooks/usePeriod';
import { preserveDemoParam } from '../utils/navigation';
import ReportGallery from './reports/ReportGallery';
import { findReport } from './reports/reportRegistry';

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
 */
export default function ReportsHub(): React.JSX.Element {
  const { reportId } = useParams<{ reportId?: string }>();
  const location = useLocation();
  // One period for the whole hub (storage key shared with the Dashboard's
  // pinned reports, so the two agree about the window as well).
  const picker = usePeriod('reportsPeriod');

  const report = findReport(reportId);
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
              to={preserveDemoParam('/reports', location.search)}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors mb-2"
            >
              <ArrowLeftIcon size={16} />
              All reports
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
          <ReportView picker={picker} />
        </Suspense>
      ) : (
        <ReportGallery />
      )}

      <PageTip
        id="reports-gallery"
        title="Financial reports"
        description="Pick a report from the gallery — net worth, balances, spending by category or payee, and period comparisons. The date range you choose stays put as you move between reports, and every figure clicks through to the transactions behind it."
      />
    </div>
  );
}
