import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, useId } from 'react';
import { createPortal } from 'react-dom';
import {
  compareAccountsByName,
  groupAccountsForDisplay,
  accountMatchesQuery,
  NO_INSTITUTION_TITLE,
  type GroupableAccount,
} from '../../utils/accountGrouping';
import { buildTopLevelIdByAccountId } from '../../utils/accountNesting';
import { ChevronDownIcon, PlusIcon } from '../icons';
import FitLabel from './FitLabel';

/**
 * The one account picker: a searchable combobox, the sibling of
 * CategorySelector. Choosing an account is the same job as choosing a
 * category — with seventy accounts a native <select> is a scroll, not a
 * choice — so it is the same control: type to filter, arrow to walk, Enter to
 * pick, with banded sections you can read at a glance.
 *
 * The bands are the Accounts page's own, both switches on: type sections
 * (Current Accounts, Savings Accounts…) with institution sub-bands nested
 * inside them, and anything unfiled in either dimension under "Other
 * Accounts", last. `accountGrouping` decides all of that, so this picker and
 * that page can never disagree about where an account belongs.
 */

/**
 * What an option needs: an id to report, plus what groups and finds it.
 *
 * `parentAccountId` is optional and most callers never set it — but where it IS
 * set it decides which SECTION the option lands in. See the `sections` memo.
 */
export interface SelectableAccount extends GroupableAccount {
  id: string;
  parentAccountId?: string | null;
}

/** Fixed-position coordinates for the portaled dropdown (usePortal mode). */
interface MenuPosition {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

/** Both switches on, always: this picker exists to show the nested bands. */
const NESTED_BANDS = { byType: true, byInstitution: true } as const;

/**
 * Internal stand-in id for the pinned clear row. The value it reports is ''
 * (no account), but '' is falsy and would fall through the highlight and
 * aria-activedescendant logic.
 */
const CLEAR_ID = '__no_account__';

/** House trigger box, by size — used when a call site names no styling of its own. */
const TRIGGER_CLASSES = {
  default:
    'w-full px-3 py-2 h-[42px] rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-sm',
  compact:
    'w-full px-2.5 py-1.5 h-auto sm:h-[32px] text-xs rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-sm',
  // A picker that IS a register cell: 36px, the height the row grows to while
  // it is being edited. Byte-for-byte the box CategorySelector's own 'row' size
  // draws, because the two swap places inside one cell and a change of question
  // must not look like a change of control.
  row:
    'w-full px-2 h-[36px] text-sm font-normal rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-sm',
} as const;

interface AccountSelectorProps<T extends SelectableAccount> {
  /** Already filtered by the caller — this component only orders and bands. */
  accounts: readonly T[];
  /** The selected account id, or '' for none. */
  selectedAccountId: string;
  onAccountChange: (accountId: string) => void;
  /** Trigger text when nothing is chosen, and the search box's own hint. */
  placeholder?: string;
  /** Search box hint, when it should read differently from the placeholder. */
  searchPlaceholder?: string;
  /**
   * Trigger box styling. Replaces the house box entirely (Tailwind cannot be
   * relied on to resolve two conflicting utilities), so a call site whose row
   * has its own look keeps it. Omit it to get the house box `size` selects.
   */
  className?: string;
  /**
   * House trigger box to use when `className` is absent. 'compact' matches the
   * register quick-add dock's 32px fields, exactly as CategorySelector's does.
   */
  size?: 'default' | 'compact' | 'row';
  /**
   * Bump this number to open the list with an empty search and the cursor in
   * it. The same handshake CategorySelector uses, and for the same caller: the
   * register's row editor, where "put the cursor here" and "open the list" are
   * one thing rather than two.
   *
   * Zero (and absent) mean "nothing has been asked for", so a picker that
   * merely mounts with the prop wired up never opens itself.
   */
  openSearchToken?: number;
  /**
   * Render the dropdown in a fixed-position portal on document.body instead of
   * absolutely inside this component. Needed inside scroll containers that clip
   * their overflow (a modal body's `overflow-y-auto` would cut the list off),
   * and it picks up/down by the room available. Off by default, where the list
   * opens downward in flow.
   */
  usePortal?: boolean;
  /** Account ids to leave out — e.g. the account a transfer starts from. */
  excludeIds?: readonly string[];
  /** Option text. Defaults to the account name; call sites that print a
      balance or a type pass their own so their wording is unchanged. */
  formatLabel?: (account: T) => string;
  /**
   * A pinned first row that selects "no account" (''), in the caller's own
   * words — "Keep in current account", "Skip (don't link)". Delete/Backspace
   * on the closed picker clears the selection the same way. Omit it where an
   * account is required.
   */
  clearOption?: string;
  /**
   * A trailing action row that reports its own sentinel value rather than an
   * account id — the bank-link wizard's "Create New Account".
   */
  createOption?: { label: string; value: string };
  /** Accessible name for the trigger and its listbox. */
  ariaLabel?: string;
  /** Marks the trigger aria-required. There is no native <select> to police
      it, so the call site's own submit validation still does. */
  required?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  /** Fired when focus leaves the picker entirely — for call sites that mark a
      field "touched" on blur before showing its validation message. */
  onBlur?: () => void;
  /**
   * What Enter means on the CLOSED trigger.
   *
   * 'open' (the default) is the ARIA combobox convention: Enter opens the list.
   *
   * 'pass-through' leaves Enter alone so the surrounding form can act on it —
   * the register's Quick Add row, where Enter is "add this transaction" from
   * every field. This picker and CategorySelector take turns in that one slot,
   * so they answer the key identically or the row behaves differently
   * depending on which question it is asking. Space and the arrows still open.
   */
  closedEnter?: 'open' | 'pass-through';
}

/**
 * A key that types a character, as opposed to one that commands. Alt is
 * excluded as well as Ctrl/Meta: a macOS Option chord produces a one-character
 * key the user meant as a shortcut, not as a filter.
 */
const isPrintableKey = (e: React.KeyboardEvent): boolean =>
  e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

/** One institution sub-band: a heading (or none) and the rows beneath it. */
interface VisibleSubBand<T extends SelectableAccount> {
  key: string;
  /** null where a heading would say nothing — see `sections` below. */
  title: string | null;
  accounts: T[];
}

/** One type section: its heading and the institution sub-bands inside it. */
interface VisibleSection<T extends SelectableAccount> {
  key: string;
  title: string;
  subBands: VisibleSubBand<T>[];
}

export default function AccountSelector<T extends SelectableAccount>({
  accounts,
  selectedAccountId,
  onAccountChange,
  placeholder = 'Search or select account…',
  searchPlaceholder,
  className,
  size = 'default',
  usePortal = false,
  excludeIds,
  formatLabel,
  clearOption,
  createOption,
  ariaLabel = 'Account',
  required = false,
  ariaInvalid,
  ariaDescribedBy,
  onBlur,
  openSearchToken,
  closedEnter = 'open',
}: AccountSelectorProps<T>): React.JSX.Element {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const instanceId = useId();
  const listboxId = `${instanceId}-listbox`;
  const optionDomId = (id: string): string => `${instanceId}-opt-${id}`;

  // A caller asking for the cursor (see openSearchToken). The search input is
  // autoFocused as it mounts, so opening the list IS handing over the keyboard.
  useEffect(() => {
    if (!openSearchToken) return;
    setSearchTerm('');
    setHighlightIndex(-1);
    setShowDropdown(true);
  }, [openSearchToken]);

  const labelFor = useCallback(
    (account: T): string => (formatLabel ? formatLabel(account) : account.name),
    [formatLabel]
  );

  // The visible bands: the Accounts page's nested grouping, narrowed by the
  // search. A section (or a sub-band) survives only while it still holds a
  // hit, so the list never shows a heading with nothing under it.
  const sections = useMemo<VisibleSection<T>[]>(() => {
    const excluded = new Set(excludeIds ?? []);
    const pool = accounts.filter(
      account => !excluded.has(account.id) && accountMatchesQuery(account, searchTerm)
    );
    /*
     * A LINKED CASH ACCOUNT IS FILED WHERE ITS INVESTMENT LIVES, not where its
     * own type would put it.
     *
     * Reported from the transfer picker: "(Beards) - Wiseville Investments" and
     * "Coutts - Investment P…" are the cash sleeves of investment accounts, and
     * both were listed under CURRENT ACCOUNTS — while the Accounts page shows
     * them nested inside their investment parent. The owner's rule, which is
     * simply the page's own behaviour written down: "linked, it sits within the
     * investment account it is linked to; unlink, and it moves up to current
     * accounts."
     *
     * The header of this file already promised that this picker "and that page
     * can never disagree about where an account belongs". They did disagree,
     * because the page groups only TOP-LEVEL accounts and renders children
     * inside their parent's row, while this list handed every account to the
     * grouper on its own terms — so a cash sleeve was sectioned by `type:
     * 'current'` rather than by the investment it belongs to.
     *
     * Sectioning is therefore done with the ANCESTOR's type and institution,
     * and only the sectioning: the option that gets rendered, searched, and
     * reported is the real account, so its own name and type still show. The
     * ancestor is resolved against the FULL account list rather than the
     * filtered pool, because a search that matches the child but not its parent
     * must still file the child correctly.
     */
    const topLevelIdByAccountId = buildTopLevelIdByAccountId(accounts);
    const byId = new Map(accounts.map(account => [account.id, account]));
    const forGrouping = pool.map(account => {
      const topLevelId = topLevelIdByAccountId.get(account.id);
      const ancestor = topLevelId !== undefined && topLevelId !== account.id
        ? byId.get(topLevelId)
        : undefined;
      return {
        // Everything the grouper reads, taken from the ancestor when there is
        // one; everything the LIST reads comes off `source` below.
        name: account.name,
        type: ancestor?.type ?? account.type,
        institution: ancestor?.institution ?? account.institution,
        sortCode: account.sortCode,
        source: account,
      };
    });

    const groupedProxies = groupAccountsForDisplay(forGrouping, NESTED_BANDS);
    const grouped = groupedProxies.mode === 'grouped'
      ? {
          mode: 'grouped' as const,
          groups: groupedProxies.groups.map(group => ({
            ...group,
            accounts: group.accounts.map(proxy => proxy.source),
            subGroups: group.subGroups?.map(sub => ({
              ...sub,
              accounts: sub.accounts.map(proxy => proxy.source),
            })),
          })),
        }
      : { mode: 'flat' as const, accounts: groupedProxies.accounts.map(proxy => proxy.source) };
    // byType is on, so grouping is always banded; [] is the honest floor.
    const groups = grouped.mode === 'grouped' ? grouped.groups : [];
    return groups.map(group => {
      const subGroups = group.subGroups ?? [];
      // A section whose ONLY sub-band is the no-institution catch-all gets no
      // sub-heading: with nothing to tell apart, "Other Accounts" under
      // "Savings Accounts" is a line of chrome that says nothing.
      const namedSubBands = !(subGroups.length === 1 && subGroups[0].title === NO_INSTITUTION_TITLE);
      return {
        key: group.label,
        title: group.title,
        subBands: subGroups.map(sub => ({
          key: sub.label,
          title: namedSubBands ? sub.title : null,
          // The page sorts its own rows, so the grouping deliberately keeps
          // input order; a picker wants them alphabetical — and by the app's
          // one definition of alphabetical, not a local retelling of it.
          accounts: [...sub.accounts].sort(compareAccountsByName),
        })),
      };
    });
  }, [accounts, excludeIds, searchTerm]);

  // Flat view of every option the arrow keys can reach, in render order.
  const flatOptions = useMemo<Array<{ id: string; label: string }>>(
    () => [
      ...(clearOption !== undefined ? [{ id: CLEAR_ID, label: clearOption }] : []),
      ...sections.flatMap(section =>
        section.subBands.flatMap(band =>
          band.accounts.map(account => ({ id: account.id, label: labelFor(account) }))
        )
      ),
      ...(createOption !== undefined ? [{ id: createOption.value, label: createOption.label }] : []),
    ],
    [sections, clearOption, createOption, labelFor]
  );
  const highlightedId = highlightIndex >= 0 ? flatOptions[highlightIndex]?.id : undefined;

  const selectedAccount = selectedAccountId
    ? accounts.find(account => account.id === selectedAccountId)
    : undefined;

  // Anchor the portaled menu to the trigger. Chooses up/down by available
  // space and recomputes on scroll/resize so it tracks the trigger inside a
  // scrolling modal body.
  const computeMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const maxMenu = 384; // matches the non-portal max-h-96
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < Math.min(maxMenu, 240) && spaceAbove > spaceBelow;
    const available = (openUp ? spaceAbove : spaceBelow) - gap - 8;
    const maxHeight = Math.max(160, Math.min(maxMenu, available));
    setMenuPos({
      left: rect.left,
      width: rect.width,
      maxHeight,
      ...(openUp ? { bottom: window.innerHeight - rect.top + gap } : { top: rect.bottom + gap }),
    });
  }, []);

  useLayoutEffect(() => {
    if (!usePortal || !showDropdown) {
      setMenuPos(null);
      return;
    }
    computeMenuPosition();
    const onReflow = (): void => computeMenuPosition();
    // Capture phase so it also fires for the scrolling modal body, not just window.
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [usePortal, showDropdown, computeMenuPosition]);

  // Any change to the option list invalidates the highlight.
  useEffect(() => {
    setHighlightIndex(-1);
  }, [showDropdown, searchTerm]);

  // The search box takes the keyboard as the list opens, with the caret AFTER
  // whatever seeded it: opening by typing puts that character in the box, and a
  // browser that parked the caret at 0 would send the next keystroke in front
  // of it. Keyed on showDropdown alone, so it runs once per opening.
  useEffect(() => {
    if (!showDropdown) return;
    const el = searchInputRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }, [showDropdown]);

  // Close on outside click. The portaled menu lives outside containerRef, so
  // it is checked separately — otherwise a click on a row would count as
  // "outside" and close the menu before the option's onClick could fire.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node;
      const inTrigger = containerRef.current?.contains(target) ?? false;
      const inMenu = menuRef.current?.contains(target) ?? false;
      if (!inTrigger && !inMenu) {
        setShowDropdown(false);
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

  const handleSelect = (optionId: string): void => {
    onAccountChange(optionId === CLEAR_ID ? '' : optionId);
    setShowDropdown(false);
    setSearchTerm('');
  };

  const closeAndRefocus = (): void => {
    setShowDropdown(false);
    setSearchTerm('');
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (showDropdown) return; // the search input owns keys while open
    if (e.key === 'Enter' && closedEnter === 'pass-through') return; // the form's key
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setShowDropdown(true);
    } else if (
      clearOption !== undefined &&
      selectedAccountId &&
      (e.key === 'Delete' || e.key === 'Backspace')
    ) {
      e.preventDefault();
      onAccountChange('');
    } else if (isPrintableKey(e)) {
      // Typing opens the list with that character already filtering it — the
      // behaviour a native <select> had and this control lost. Space is caught
      // above and opens with an empty search: a leading space filters nothing.
      e.preventDefault();
      setSearchTerm(e.key);
      setShowDropdown(true);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex(i => Math.min(i + 1, flatOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter': {
        e.preventDefault();
        // With no explicit highlight, Enter takes the sole matching ACCOUNT —
        // never the clear or create row, which are not what a search narrowed to.
        const accountsOnly = flatOptions.filter(
          option => option.id !== CLEAR_ID && option.id !== createOption?.value
        );
        const chosen =
          flatOptions[highlightIndex] ?? (accountsOnly.length === 1 ? accountsOnly[0] : undefined);
        if (chosen) handleSelect(chosen.id);
        break;
      }
      case 'Escape':
        e.preventDefault();
        closeAndRefocus();
        break;
      case 'Tab':
        // Let focus move on naturally, but don't leave the menu hanging open.
        setShowDropdown(false);
        setSearchTerm('');
        break;
    }
  };

  // "Touched" means the user has finished with the field, so this fires only
  // when focus leaves the whole picker — not when it hops from the trigger to
  // the search box inside it.
  const handleContainerBlur = (e: React.FocusEvent<HTMLDivElement>): void => {
    if (!onBlur) return;
    const next = e.relatedTarget;
    if (next instanceof Node && containerRef.current?.contains(next)) return;
    onBlur();
  };

  const rowClasses = (optionId: string, extra: string): string =>
    `${extra} py-2 pr-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${
      highlightedId === optionId
        ? 'bg-gray-100 dark:bg-gray-600'
        : selectedAccountId === optionId
          ? 'bg-blue-50 dark:bg-blue-900/20'
          : ''
    }`;

  const menu = (
    <div
      ref={usePortal ? menuRef : undefined}
      id={listboxId}
      role="listbox"
      aria-label={ariaLabel}
      style={
        usePortal && menuPos
          ? {
              position: 'fixed',
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
              zIndex: 9999,
              ...(menuPos.top !== undefined ? { top: menuPos.top } : { bottom: menuPos.bottom }),
            }
          : undefined
      }
      className={
        usePortal
          ? 'overflow-y-auto bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg text-sm'
          : 'absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50 text-sm'
      }
    >
      {/* Pinned clear row: selecting it reports no account at all. */}
      {clearOption !== undefined && (
        <div
          id={optionDomId(CLEAR_ID)}
          role="option"
          aria-selected={selectedAccountId === ''}
          data-highlighted-option={highlightedId === CLEAR_ID ? instanceId : undefined}
          className={rowClasses(CLEAR_ID, 'pl-3 border-b border-gray-100 dark:border-gray-600')}
          onClick={() => handleSelect(CLEAR_ID)}
        >
          <span className="italic text-gray-500 dark:text-gray-400">{clearOption}</span>
        </div>
      )}

      {sections.length > 0 ? (
        sections.map(section => (
          // A band is a group, not a heading: the section's name reaches a
          // screen reader through the group label, so the printed heading is
          // hidden from it rather than read twice.
          <div key={section.key} role="group" aria-label={section.title}>
            {/* Type band — the STRONGER of the two: the same darker,
                bordered treatment CategorySelector gives its sections, so the
                two pickers read as one design. */}
            <div
              aria-hidden="true"
              className="sticky top-0 z-10 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-500 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300"
            >
              {section.title}
            </div>
            {section.subBands.map(band => (
              <div
                key={band.key}
                role={band.title !== null ? 'group' : undefined}
                aria-label={band.title ?? undefined}
              >
                {/* Institution band — the QUIETER of the two: indented,
                    smaller, dimmer and with no divider rule, so it reads as a
                    subdivision of the section above rather than a rival to
                    it. The dark tint is a shade off the menu's own so the
                    band is still a band in dark mode, not a stray line. */}
                {band.title !== null && (
                  <div
                    aria-hidden="true"
                    className="pl-6 pr-3 py-1 bg-gray-50 dark:bg-gray-800/50 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    {band.title}
                  </div>
                )}
                {band.accounts.map(account => (
                  <div
                    key={account.id}
                    id={optionDomId(account.id)}
                    role="option"
                    aria-selected={selectedAccountId === account.id}
                    data-highlighted-option={
                      highlightedId === account.id ? instanceId : undefined
                    }
                    className={rowClasses(account.id, band.title !== null ? 'pl-10' : 'pl-8')}
                    onClick={() => handleSelect(account.id)}
                  >
                    {/* No per-row glyph: two levels of band already carry the
                        structure, and an account label ("Natwest Current
                        Account (£12,345.67)") needs every pixel of the width
                        an icon would take. */}
                    <span className="block truncate font-medium text-gray-900 dark:text-white">
                      {labelFor(account)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))
      ) : (
        <div className="px-3 py-2 text-gray-500 dark:text-gray-400 text-center">
          {searchTerm ? 'No accounts found' : 'No accounts available'}
        </div>
      )}

      {createOption !== undefined && (
        <div
          id={optionDomId(createOption.value)}
          role="option"
          aria-selected={selectedAccountId === createOption.value}
          data-highlighted-option={
            highlightedId === createOption.value ? instanceId : undefined
          }
          className={rowClasses(
            createOption.value,
            'pl-3 border-t border-gray-200 dark:border-gray-600 text-primary dark:text-blue-400'
          )}
          onClick={() => handleSelect(createOption.value)}
        >
          <div className="flex items-center gap-2">
            <PlusIcon size={14} />
            <span className="font-medium">{createOption.label}</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative" ref={containerRef} onBlur={handleContainerBlur}>
      <div
        ref={triggerRef}
        tabIndex={0}
        role="combobox"
        aria-expanded={showDropdown}
        aria-haspopup="listbox"
        aria-controls={showDropdown ? listboxId : undefined}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        onKeyDown={handleTriggerKeyDown}
        onClick={() => setShowDropdown(open => !open)}
        className={`${className ?? TRIGGER_CLASSES[size]} cursor-text flex items-center`}
      >
        <div className="flex w-full min-w-0 items-center justify-between gap-1">
          <div className="flex-1 min-w-0">
            {showDropdown ? (
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                // The trigger toggles the menu; a click that lands in the
                // search box is placing a cursor, not asking to close.
                onClick={e => e.stopPropagation()}
                // Filtering a list of account names, none of which the
                // dictionary has heard of.
                spellCheck={false}
                autoCapitalize="none"
                placeholder={searchPlaceholder ?? placeholder}
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-activedescendant={highlightedId ? optionDomId(highlightedId) : undefined}
                className="w-full bg-transparent text-gray-900 dark:text-white !border-0 focus:!outline-none focus-visible:!outline-none"
                autoFocus
              />
            ) : (
              <FitLabel
                text={selectedAccount ? labelFor(selectedAccount) : placeholder}
                muted={!selectedAccount}
              />
            )}
          </div>
          <ChevronDownIcon
            size={16}
            className={`text-gray-400 shrink-0 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* In-flow (opens downward) by default, or a fixed-position portal on
          document.body when usePortal escapes a clipping scroll container. */}
      {showDropdown && (usePortal ? (menuPos ? createPortal(menu, document.body) : null) : menu)}
    </div>
  );
}
