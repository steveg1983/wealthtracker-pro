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
    <div className="space-y-14">
      {/* space-y-14, not 8. The groups are "What I have", "Spending" and
          "Custom reports", and at 32px the gap between two GROUPS was barely
          bigger than the 16px gap between two cards inside one — so the page
          read as eleven cards in a stack rather than as three answers to three
          different questions. The heading is what separates them; it needs
          room to be seen doing it.

          (A JSX comment cannot sit between `return (` and the element. Fourth
          time this has bitten today — it is always the same shape: one
          expression slot, and a comment is an expression.) */}
      {REPORT_GROUPS.map(group => {
        const reports = reportsInGroup(group.id);
        return (
          <section key={group.id} aria-labelledby={`report-group-${group.id}`}>
            <div className="mb-4">
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
                return (
                  <li key={report.id}>
                    {/* No chevron: the whole card is the link, and an arrow
                        announcing that is chrome charged against the words that
                        say what the report is (P1).
                        No icon either, since 15 August. The note that used to
                        stand here argued a 20px glyph needs no box behind it —
                        true, and it stopped one step short. Eleven cards each
                        carrying a glyph, three of them the same pie, meant the
                        icons distinguished nothing and the titles did all the
                        work. The same reduction the Accounts page made when it
                        dropped its per-row type icons (#281): one icon per
                        KIND, never one per row. */}
                    <Link
                      to={preserveDemoParam(`/reports/${report.id}`, location.search)}
                      className="group h-full flex items-start gap-3 bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-4 hover:border-primary dark:hover:border-blue-500 transition-colors duration-state"
                    >
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
