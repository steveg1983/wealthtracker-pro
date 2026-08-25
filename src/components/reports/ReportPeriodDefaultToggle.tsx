import React from 'react';
import { CheckCircleIcon } from '../icons';

/**
 * "Open this report on this period from now on."
 *
 * The owner's design, 25 Aug: changing the window is a LOOK, saving it is a
 * DECISION. So the period pills do not persist anything, and this is the
 * control that does — ticked exactly while the saved default equals what is
 * on screen, which is why "the button unticks itself" when the window
 * changes without anyone implementing unticking.
 *
 * It is a button rather than a checkbox on purpose. A checkbox describes a
 * state you are free to toggle; this performs an action in one direction —
 * pressing it while it is already ticked would either do nothing or silently
 * FORGET the default, and neither is what a tick invites. Clearing is
 * available and says so in words instead.
 *
 * Quiet by default, per the house rule: this is a settled state, not
 * something needing attention, so the ticked form is neutral rather than
 * green. Colour marks what needs looking at.
 */
export default function ReportPeriodDefaultToggle({
  isDefault,
  periodLabel,
  onSave,
  onClear,
}: {
  /** True while the saved default is what the reader is looking at. */
  isDefault: boolean;
  /** The window's own name, so the control says what it would save. */
  periodLabel: string;
  onSave: () => void;
  onClear: () => void;
}): React.JSX.Element {
  if (isDefault) {
    return (
      <div className="flex items-center gap-2 text-dense text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5">
          <CheckCircleIcon size={14} aria-hidden="true" />
          Opens on {periodLabel}
        </span>
        <button
          type="button"
          onClick={onClear}
          className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-200 rounded"
        >
          Clear
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSave}
      className="text-dense text-gray-500 dark:text-gray-400 underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-200 rounded"
    >
      Always open on {periodLabel}
    </button>
  );
}
