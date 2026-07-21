import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, useId } from 'react';
import { createPortal } from 'react-dom';
import type { Account } from '../../types';
import { CREATE_NEW_VALUE, SKIP_ID, accountMatchesSearch, groupAccountsForPicker } from './accountPickerOptions';
import { ChevronDownIcon, PlusIcon } from '../icons';

/**
 * Searchable combobox for picking an app account to link a discovered bank
 * account to. Follows the accessible combobox pattern proven in
 * CategorySelector (role="combobox", aria-activedescendant, full keyboard
 * support), with the account-section grouping from PR #113. Always renders
 * its menu in a fixed-position portal: it lives inside the Link Accounts
 * modal, whose scrolling body would clip an in-flow dropdown.
 */

const accountDisplayText = (account: Account): string =>
  `${account.name}${account.institution ? ` (${account.institution})` : ''}${account.sortCode ? ` - ${account.sortCode}` : ''}`;

interface MenuPosition {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

interface AccountPickerComboboxProps {
  accounts: Account[];
  /** Selected app account id, '' for skip, or CREATE_NEW_VALUE. */
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

export default function AccountPickerCombobox({
  accounts,
  value,
  onChange,
  ariaLabel
}: AccountPickerComboboxProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const instanceId = useId();
  const listboxId = `${instanceId}-listbox`;
  const optionDomId = (id: string): string => `${instanceId}-opt-${id}`;

  const groups = useMemo(() => {
    const grouped = groupAccountsForPicker(accounts);
    if (!searchTerm.trim()) {
      return grouped;
    }
    return grouped
      .map((group) => ({
        label: group.label,
        accounts: group.accounts.filter((a) => accountMatchesSearch(a, searchTerm))
      }))
      .filter((group) => group.accounts.length > 0);
  }, [accounts, searchTerm]);

  // Flat render-order view of every option the arrow keys can reach.
  const flatOptions = useMemo(
    () => [
      { id: SKIP_ID, label: "Skip (don't link)" },
      ...groups.flatMap((group) =>
        group.accounts.map((a) => ({ id: a.id, label: accountDisplayText(a) }))
      ),
      { id: CREATE_NEW_VALUE, label: '+ Create New Account' }
    ],
    [groups]
  );
  const highlightedId = highlightIndex >= 0 ? flatOptions[highlightIndex]?.id : undefined;

  const selectedAccount = value && value !== CREATE_NEW_VALUE
    ? accounts.find((a) => a.id === value)
    : undefined;

  // Anchor the portaled menu to the trigger; choose up/down by available space
  // and track the trigger while the modal body scrolls.
  const computeMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const maxMenu = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < Math.min(maxMenu, 240) && spaceAbove > spaceBelow;
    const available = (openUp ? spaceAbove : spaceBelow) - gap - 8;
    const maxHeight = Math.max(160, Math.min(maxMenu, available));
    setMenuPos({
      left: rect.left,
      width: rect.width,
      maxHeight,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap })
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    computeMenuPosition();
    const onReflow = () => computeMenuPosition();
    // Capture phase so the scrolling modal body also triggers repositioning.
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [open, computeMenuPosition]);

  useEffect(() => {
    setHighlightIndex(-1);
  }, [open, searchTerm]);

  // Close on outside click — the portaled menu is outside containerRef, so it
  // must be checked separately or option clicks would close before firing.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inTrigger = containerRef.current?.contains(target) ?? false;
      const inMenu = menuRef.current?.contains(target) ?? false;
      if (!inTrigger && !inMenu) {
        setOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keep the highlighted option scrolled into view while arrowing.
  useEffect(() => {
    if (highlightIndex < 0) return;
    const el = document.querySelector(`[data-highlighted-option="${instanceId}"]`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [highlightIndex, instanceId]);

  const selectOption = (id: string): void => {
    onChange(id === SKIP_ID ? '' : id);
    setOpen(false);
    setSearchTerm('');
  };

  const closeAndRefocus = (): void => {
    setOpen(false);
    setSearchTerm('');
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (open) return; // the search input owns keys while open
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, flatOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter': {
        e.preventDefault();
        // With no explicit highlight, Enter picks the sole matching account.
        const accountOnly = flatOptions.filter(
          (o) => o.id !== SKIP_ID && o.id !== CREATE_NEW_VALUE
        );
        const chosen = flatOptions[highlightIndex] ??
          (accountOnly.length === 1 ? accountOnly[0] : undefined);
        if (chosen) selectOption(chosen.id);
        break;
      }
      case 'Escape':
        e.preventDefault();
        closeAndRefocus();
        break;
      case 'Tab':
        setOpen(false);
        setSearchTerm('');
        break;
    }
  };

  const optionClasses = (id: string, extra = ''): string =>
    `px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${
      highlightedId === id
        ? 'bg-gray-100 dark:bg-gray-600'
        : value === id
          ? 'bg-blue-50 dark:bg-blue-900/20'
          : ''
    } ${extra}`;

  return (
    <div className="relative" ref={containerRef}>
      <div
        ref={triggerRef}
        tabIndex={0}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        onKeyDown={handleTriggerKeyDown}
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-xl shadow-sm cursor-text flex items-center justify-between gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <div className="flex-1 min-w-0">
          {open ? (
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Type to search accounts..."
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-activedescendant={highlightedId ? optionDomId(highlightedId) : undefined}
              className="w-full bg-transparent text-gray-900 dark:text-white !border-0 focus:!outline-none focus-visible:!outline-none"
              autoFocus
            />
          ) : selectedAccount ? (
            <span className="block truncate text-gray-900 dark:text-white">
              {accountDisplayText(selectedAccount)}
            </span>
          ) : (
            <span className="block truncate text-gray-500 dark:text-gray-400">
              Skip (don&apos;t link)
            </span>
          )}
        </div>
        <ChevronDownIcon
          size={16}
          className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && menuPos && createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'fixed',
            left: menuPos.left,
            width: menuPos.width,
            maxHeight: menuPos.maxHeight,
            zIndex: 9999,
            ...(menuPos.top !== undefined ? { top: menuPos.top } : { bottom: menuPos.bottom })
          }}
          className="overflow-y-auto bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg text-sm"
        >
          <div
            id={optionDomId(SKIP_ID)}
            role="option"
            aria-selected={value === ''}
            data-highlighted-option={highlightedId === SKIP_ID ? instanceId : undefined}
            className={optionClasses(SKIP_ID, 'border-b border-gray-100 dark:border-gray-600')}
            onClick={() => selectOption(SKIP_ID)}
          >
            <span className="italic text-gray-500 dark:text-gray-400">
              -- Skip (don&apos;t link) --
            </span>
          </div>

          {groups.length > 0 ? (
            groups.map((group) => (
              <div key={group.label}>
                <div className="sticky top-0 z-10 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {group.label}
                </div>
                {group.accounts.map((account) => (
                  <div
                    key={account.id}
                    id={optionDomId(account.id)}
                    role="option"
                    aria-selected={value === account.id}
                    data-highlighted-option={highlightedId === account.id ? instanceId : undefined}
                    className={optionClasses(account.id, 'pl-6')}
                    onClick={() => selectOption(account.id)}
                  >
                    <span className="block truncate text-gray-900 dark:text-white">
                      {accountDisplayText(account)}
                    </span>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-gray-500 dark:text-gray-400 text-center">
              No accounts match &ldquo;{searchTerm}&rdquo;
            </div>
          )}

          <div
            id={optionDomId(CREATE_NEW_VALUE)}
            role="option"
            aria-selected={false}
            data-highlighted-option={highlightedId === CREATE_NEW_VALUE ? instanceId : undefined}
            className={optionClasses(CREATE_NEW_VALUE, 'border-t border-gray-200 dark:border-gray-600 text-primary dark:text-blue-400')}
            onClick={() => selectOption(CREATE_NEW_VALUE)}
          >
            <div className="flex items-center gap-2">
              <PlusIcon size={14} />
              <span className="font-medium">Create New Account</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
