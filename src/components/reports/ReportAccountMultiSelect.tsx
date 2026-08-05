import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDownIcon, FilterIcon } from '../icons';
import type { Account } from '../../types';
import type { ReportAccountSelection } from '../../hooks/useReportAccountSelection';

/**
 * The reports' account filter when a report can answer for SEVERAL accounts
 * at once: a checkbox per account behind one trigger, rather than the
 * one-account-or-all dropdown.
 *
 * The trigger states the whole filter in a few words — "All accounts", the
 * account's own name when it is the only one ticked, otherwise how many — so
 * the figures below it are never unexplained.
 */
export default function ReportAccountMultiSelect({
  accounts,
  selection,
}: {
  accounts: Account[];
  selection: ReportAccountSelection;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstCheckboxRef = useRef<HTMLInputElement>(null);
  const panelId = `${useId()}-accounts`;

  const summary = useMemo(() => {
    if (selection.isAll) return 'All accounts';
    const ids = [...selection.selectedIds];
    if (ids.length === 0) return 'No accounts';
    if (ids.length === 1) {
      // A named account that no longer exists still counts as one choice.
      return accounts.find(account => account.id === ids[0])?.name ?? '1 account';
    }
    return `${ids.length} accounts`;
  }, [selection, accounts]);

  // Close on a click anywhere else — mousedown, so the click that opens
  // another control is not swallowed by the panel closing first.
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Opening moves focus into the list, so the keyboard reaches the checkboxes
  // without tabbing past the trigger.
  useEffect(() => {
    if (open) firstCheckboxRef.current?.focus();
  }, [open]);

  const close = (): void => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      close();
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>): void => {
    // Tabbing out closes the panel; a click on the panel's own padding blurs
    // to nothing at all, and must NOT.
    const next = event.relatedTarget;
    if (next instanceof Node && !containerRef.current?.contains(next)) setOpen(false);
  };

  const actionClass =
    'text-xs font-medium text-primary dark:text-blue-400 rounded px-1 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary';

  return (
    <div className="flex items-center gap-2">
      <FilterIcon className="text-gray-500" size={18} />
      <div className="relative" ref={containerRef} onKeyDown={handleKeyDown} onBlur={handleBlur}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(current => !current)}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {/* The visible text is the value; the control still has to say what
              it is for. */}
          <span className="sr-only">Account filter</span>
          <span className="max-w-[220px] truncate">{summary}</span>
          <ChevronDownIcon
            size={16}
            className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div
            id={panelId}
            role="group"
            aria-label="Accounts included in this report"
            className="absolute left-0 z-30 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Accounts
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={selection.selectAll} className={actionClass}>
                  Select all
                </button>
                <button type="button" onClick={selection.deselectAll} className={actionClass}>
                  Deselect all
                </button>
              </div>
            </div>

            {accounts.length === 0 ? (
              <p className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">No accounts yet.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto py-1">
                {accounts.map((account, index) => (
                  <label
                    key={account.id}
                    className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <input
                      ref={index === 0 ? firstCheckboxRef : undefined}
                      type="checkbox"
                      checked={selection.isSelected(account.id)}
                      onChange={() => selection.toggle(account.id)}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-2 focus:ring-primary"
                    />
                    <span className="truncate text-gray-900 dark:text-white">{account.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
