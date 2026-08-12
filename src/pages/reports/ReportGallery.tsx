import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { preserveDemoParam } from '../../utils/navigation';
import { REPORT_GROUPS, reportsInGroup } from './reportRegistry';

/**
 * The gallery itself: every report, grouped by the question it answers.
 *
 * Real links, not buttons — each report has its own URL, so it can be
 * bookmarked, opened in a new tab, and pinned to the Dashboard.
 */

/**
 * How many columns a section of `count` reports is laid out in.
 *
 * A four-item section in a 3-up grid leaves one card stranded on a row of its
 * own, which reads as "and this one is different" about a report that is not
 * (DESIGN_PASS_2026-08 §3.5). Four splits evenly two ways, so it takes the
 * 2-up track; everything else keeps the 3-up it had.
 *
 * Whole class strings, not interpolation: Tailwind scans this file as text and
 * only emits classes it can actually see written down.
 */
const gridColumnsClass = (count: number): string =>
  count === 4
    ? 'md:grid-cols-2'
    : 'md:grid-cols-2 xl:grid-cols-3';

export default function ReportGallery(): React.JSX.Element {
  const location = useLocation();

  return (
    <div className="space-y-8">
      {REPORT_GROUPS.map(group => {
        const reports = reportsInGroup(group.id);
        return (
          <section key={group.id} aria-labelledby={`report-group-${group.id}`}>
            <div className="mb-3">
              <h2
                id={`report-group-${group.id}`}
                className="text-card font-semibold text-gray-900 dark:text-white"
              >
                {group.title}
              </h2>
              <p className="text-body text-gray-500 dark:text-gray-400">{group.description}</p>
              {/* Permanent, not dismissible, and deliberately quiet: it is a
                  caveat on every figure below it, not a warning about any one
                  of them. */}
              {group.note && (
                <p className="mt-1 text-dense text-gray-500 dark:text-gray-400">{group.note}</p>
              )}
            </div>

            <ul className={`grid grid-cols-1 ${gridColumnsClass(reports.length)} gap-4`}>
              {reports.map(report => {
                const Icon = report.icon;
                return (
                  <li key={report.id}>
                    {/* No chevron: the whole card is the link, and an arrow
                        announcing that is chrome charged against the words that
                        say what the report is (P1). No tile behind the icon
                        either — a 20px glyph does not need a box to be found. */}
                    <Link
                      to={preserveDemoParam(`/reports/${report.id}`, location.search)}
                      className="group h-full flex items-start gap-3 bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-4 hover:border-primary dark:hover:border-blue-500 transition-colors duration-state focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <Icon
                        size={20}
                        className="mt-0.5 flex-shrink-0 text-gray-500 dark:text-gray-400 group-hover:text-primary dark:group-hover:text-blue-400"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-body font-semibold text-gray-900 dark:text-white group-hover:text-primary dark:group-hover:text-blue-400">
                          {report.title}
                        </span>
                        <span className="mt-1 block text-body text-gray-500 dark:text-gray-400">
                          {report.description}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
