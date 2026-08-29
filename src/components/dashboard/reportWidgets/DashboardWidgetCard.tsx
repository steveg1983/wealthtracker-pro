import React from 'react';
import { ChevronRightIcon } from '../../icons';
import { WIDGET_SUBTITLE_SLOT } from './widgetChrome';

/**
 * The shell every report card on the Dashboard wears: title, one line under it,
 * and the whole header as the way into the full report.
 *
 * Its own module rather than a private helper, because the Account
 * Distribution card lives in ImprovedDashboard and the other three live in
 * DashboardReportWidgets — and a card that "looks the same" in two files is a
 * card that stops looking the same at the first edit.
 */
export default function DashboardWidgetCard({
  title,
  subtitle,
  onOpen,
  children,
}: {
  title: string;
  /**
   * The line under the title. Optional: a card with no chart (a pinned custom
   * report) has nothing to line up with, and an empty slot there would be a gap
   * rather than a layout.
   */
  subtitle?: React.ReactNode;
  onOpen: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    // `group/card` is what the card's quiet controls hang off: a period
    // affordance that is charged rent has to know when the card is hovered or
    // holds focus (see CardPeriodControl). Named rather than bare, so a nested
    // group inside a chart legend can never claim it.
    <div className="group/card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex flex-col">
      <button
        type="button"
        onClick={onOpen}
        // mb-1 when a subtitle follows (the slot carries the rest of the gap),
        // mb-2 when nothing does.
        className={`flex items-center gap-2 text-left group ${subtitle === undefined ? 'mb-2' : 'mb-1'}`}
        title="Open the full report"
      >
        {/* The hover is an underline and nothing else. The title is the way
            into the full report, but it declines a resting colour — it is the
            card's heading first — and an underline IS the link (stock-blue
            ruling, 28 Aug 2026; same answer as ACCOUNT_ROW_NAME_LINK_CLASS). */}
        <span className="text-sm font-semibold text-gray-900 dark:text-white group-hover:underline transition-colors">
          {title}
        </span>
        <ChevronRightIcon size={14} className="text-gray-400 ml-auto" aria-hidden="true" />
      </button>
      {subtitle !== undefined && (
        <div className={`${WIDGET_SUBTITLE_SLOT} mb-3`}>{subtitle}</div>
      )}
      {children}
    </div>
  );
}
