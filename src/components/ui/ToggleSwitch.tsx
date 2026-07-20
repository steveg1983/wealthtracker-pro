/**
 * The app's ONE toggle switch. Replaces three divergent hand-rolled patterns
 * (peer-checked labels, ad-hoc h-6/w-11 buttons, bespoke role="switch"
 * spans) that all rendered as 44×44 blobs under the global touch-target
 * minimums.
 *
 * Accessibility: real button with role="switch" + aria-checked; the touch
 * target is kept ≥44px by transparent padding around the slim visual track,
 * so the `.toggle-switch` exemption from the blanket button minimums never
 * shrinks the hit area.
 */
import { forwardRef } from 'react';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name — required unless aria-labelledby points at one. */
  'aria-label'?: string;
  'aria-labelledby'?: string;
  disabled?: boolean;
  className?: string;
}

const ToggleSwitch = forwardRef<HTMLButtonElement, ToggleSwitchProps>(function ToggleSwitch(
  { checked, onChange, disabled = false, className = '', ...aria },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={aria['aria-label']}
      aria-labelledby={aria['aria-labelledby']}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      // p-2.5 (10px) around the 24px track = 44px touch target while the
      // visible control stays slim.
      className={`toggle-switch group inline-flex items-center justify-center p-2.5 -m-2.5 rounded-full outline-none disabled:cursor-not-allowed ${className}`}
    >
      <span
        aria-hidden="true"
        className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ease-in-out
          group-focus-visible:ring-2 group-focus-visible:ring-offset-2 group-focus-visible:ring-[#1a2332] dark:group-focus-visible:ring-blue-500 dark:group-focus-visible:ring-offset-gray-800
          ${checked
            ? 'bg-[#1a2332] dark:bg-blue-600'
            : 'bg-gray-300 dark:bg-gray-600'}
          ${disabled ? 'opacity-40' : ''}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-in-out
            ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </span>
    </button>
  );
});

export default ToggleSwitch;
