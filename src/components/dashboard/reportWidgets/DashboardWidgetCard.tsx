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
  icon: Icon,
  subtitle,
  onOpen,
  children,
}: {
  title: string;
  icon: React.ElementType;
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex flex-col">
      <button
        type="button"
        onClick={onOpen}
        // mb-1 when a subtitle follows (the slot carries the rest of the gap),
        // mb-2 when nothing does.
        className={`flex items-center gap-2 text-left group ${subtitle === undefined ? 'mb-2' : 'mb-1'}`}
        title="Open the full report"
      >
        <Icon size={18} className="text-gray-500" aria-hidden="true" />
        <span className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
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
