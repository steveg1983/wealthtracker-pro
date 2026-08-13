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
 * Ticking is BATCHED: choices collect in a draft while the panel is open and
 * apply on Save, which closes it. Dismissing any other way (Escape, clicking
 * away, the trigger) discards the draft. Live-applying re-rendered the whole
 * report under the open panel on every tick — on heavy pages that could
 * reshuffle the very surface being clicked — and the owner asked for explicit
 * Save semantics outright.
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
  // The draft: account ids ticked right now, only meaningful while open.
  const [draft, setDraft] = useState<ReadonlySet<string>>(new Set());
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

  const openPanel = (): void => {
    // Seed the draft from what is currently applied.
    setDraft(new Set(
      selection.isAll ? accounts.map(account => account.id) : selection.selectedIds
    ));
    setOpen(true);
  };

  /** Close WITHOUT applying — the draft is discarded. */
  const cancel = (): void => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  /** Apply the draft to the real selection, then close. */
  const save = (): void => {
    if (draft.size === accounts.length && accounts.every(account => draft.has(account.id))) {
      // Every box ticked collapses to the 'all' sentinel, so an account
      // opened next month is included rather than silently filtered out.
      selection.selectAll();
    } else {
      selection.replace(draft);
    }
    setOpen(false);
    triggerRef.current?.focus();
  };

  const toggleDraft = (accountId: string): void => {
    setDraft(current => {
      const next = new Set(current);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  // Dismissing by clicking anywhere else cancels — mousedown, so the click
  // that opens another control is not swallowed by the panel closing first.
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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      cancel();
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>): void => {
    // Tabbing out cancels; a click on the panel's own padding blurs to
    // nothing at all, and must NOT.
    const next = event.relatedTarget;
    if (next instanceof Node && !containerRef.current?.contains(next)) setOpen(false);
  };

  const actionClass =
'text-xs font-medium text-primary dark:text-blue-400 rounded px-1 hover:underline';

  return (
    <div className="flex items-center gap-2">
      <FilterIcon className="text-gray-500" size={18} />
      <div className="relative" ref={containerRef} onKeyDown={handleKeyDown} onBlur={handleBlur}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => (open ? cancel() : openPanel())}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-lg text-gray-900 dark:text-white"
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
                <button
                  type="button"
                  onClick={() => setDraft(new Set(accounts.map(account => account.id)))}
                  className={actionClass}
                >
                  Select all
                </button>
                <button type="button" onClick={() => setDraft(new Set())} className={actionClass}>
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
                          checked={draft.has(account.id)}
                          onChange={() => toggleDraft(account.id)}
                          className="rounded border-gray-300 dark:border-gray-600 text-primary"
                        />
                        <span className="truncate text-gray-900 dark:text-white">{account.name}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Save applies the draft and closes; anything else discards it. */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={cancel}
                className="px-3 py-1 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                className="px-3 py-1 text-sm font-medium rounded-md bg-[#1a2332] dark:bg-blue-600 text-white hover:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
