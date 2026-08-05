import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDownIcon, FilterIcon } from '../icons';
import { groupAccountsBySection } from '../../utils/accountGrouping';
import type { Account } from '../../types';
import type { ReportAccountSelection } from '../../hooks/useReportAccountSelection';

/**
 * The reports' account filter: a checkbox per account behind one trigger, so
 * a report can answer for any set of accounts rather than one or all.
 *
 * The list is grouped exactly as the Accounts page groups it (shared
 * `groupAccountsBySection` — Current, Savings, Credit Cards…, alphabetical
 * inside each), because a household with seventy accounts cannot find one in a
 * flat list. Long lists scroll inside the panel with the section bands pinned.
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

  // The Accounts page's own sections, in the Accounts page's own order.
  const sections = useMemo(() => groupAccountsBySection(accounts), [accounts]);
  // Opening puts the keyboard on the first box in the list — which is the
  // first account of the first section, not the first account given.
  const firstAccountId = sections[0]?.accounts[0]?.id ?? null;

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
            className="absolute left-0 z-30 mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
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

            {sections.length === 0 ? (
              <p className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">No accounts yet.</p>
            ) : (
              /* Seventy accounts have to fit: the list scrolls, and each
                 section's band stays put while its own accounts pass under it. */
              <div className="max-h-72 overflow-y-auto">
                {sections.map(section => (
                  <div key={section.label} role="group" aria-label={section.title}>
                    {/* The same darker group-header treatment as the Accounts
                        page and the category picker — one scheme for every
                        grouping band. */}
                    <div className="sticky top-0 z-10 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-500 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                      {section.title}
                    </div>
                    {section.accounts.map(account => (
                      <label
                        key={account.id}
                        className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <input
                          ref={account.id === firstAccountId ? firstCheckboxRef : undefined}
                          type="checkbox"
                          checked={selection.isSelected(account.id)}
                          onChange={() => selection.toggle(account.id)}
                          className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-2 focus:ring-primary"
                        />
                        <span className="truncate text-gray-900 dark:text-white">{account.name}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Every tick has already been applied to the figures behind this
                panel; Done is the way back to them, not an OK button. */}
            <div className="flex justify-end px-3 py-2 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={close}
                className="px-3 py-1 text-sm font-medium rounded-md bg-[#1a2332] dark:bg-blue-600 text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
