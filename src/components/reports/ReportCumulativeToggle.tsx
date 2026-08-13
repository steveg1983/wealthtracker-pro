import React from 'react';
import type { CumulativeReportToggle } from '../../hooks/useCumulativeReport';

/**
 * The reports' "Cumulative" switch — one control, one look, one meaning, on
 * every report that can be read as a running total for the selected period.
 */
export default function ReportCumulativeToggle({
  toggle,
}: {
  toggle: CumulativeReportToggle;
}): React.JSX.Element {
  return (
    <label
      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer"
      title="Show each month as the running total for the period so far, instead of the month on its own"
    >
      <input
        type="checkbox"
        checked={toggle.cumulative}
        onChange={e => toggle.setCumulative(e.target.checked)}
        className="rounded border-gray-300 dark:border-gray-600"
      />
      Cumulative
    </label>
  );
}
