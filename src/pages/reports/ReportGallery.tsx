import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRightIcon } from '../../components/icons';
import { preserveDemoParam } from '../../utils/navigation';
import { REPORT_GROUPS, reportsInGroup } from './reportRegistry';

/**
 * The gallery itself: every report, grouped by the question it answers.
 *
 * Real links, not buttons — each report has its own URL, so it can be
 * bookmarked, opened in a new tab, and pinned to the Dashboard.
 */
export default function ReportGallery(): React.JSX.Element {
  const location = useLocation();

  return (
    <div className="space-y-8">
      {REPORT_GROUPS.map(group => (
        <section key={group.id} aria-labelledby={`report-group-${group.id}`}>
          <div className="mb-3">
            <h2
              id={`report-group-${group.id}`}
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              {group.title}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{group.description}</p>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {reportsInGroup(group.id).map(report => {
              const Icon = report.icon;
              return (
                <li key={report.id}>
                  <Link
                    to={preserveDemoParam(`/reports/${report.id}`, location.search)}
                    className="group h-full flex items-start gap-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:border-[#1a2332] dark:hover:border-blue-500 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span className="mt-0.5 flex-shrink-0 rounded-lg bg-gray-100 dark:bg-gray-700 p-2 text-gray-600 dark:text-gray-300">
                      <Icon size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-gray-900 dark:text-white group-hover:text-[#1a2332] dark:group-hover:text-blue-400">
                        {report.title}
                      </span>
                      <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">
                        {report.description}
                      </span>
                    </span>
                    <ChevronRightIcon
                      size={16}
                      className="mt-1 flex-shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
