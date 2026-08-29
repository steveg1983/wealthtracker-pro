import { useState, useRef, useEffect, useLayoutEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../contexts/AppContextSupabase';
import type { Category } from '../types';
import { ChevronDownIcon, TagIcon, PlusIcon, ArrowLeftIcon, CheckIcon } from './icons';
// The one-line shrink-then-ellipsise trigger label, shared with the account
// picker so both comboboxes wear a long name the same way.
import FitLabel from './common/FitLabel';

/** Fixed-position coordinates for the portaled dropdown (usePortal mode). */
interface MenuPosition {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

interface CategorySelectorProps {
  selectedCategory: string;
  onCategoryChange: (categoryId: string) => void;
  transactionType: 'income' | 'expense' | 'transfer';
  placeholder?: string;
  className?: string;
  allowCreate?: boolean;
  /**
   * List detail categories from BOTH directions (income + expense), not just
   * `transactionType`. For the Money-style cross-type filing the quick-edit
   * bar offers (a refund filed under the expense category it refunds).
   */
  includeAllTypes?: boolean;
  /**
   * Render the "Select a category for this … transaction" hint under the box.
   * Off in compact/inline contexts (the quick-edit bar) where a second line
   * would break the single-row layout.
   */
  showHelperText?: boolean;
  /**
   * Render the dropdown in a fixed-position portal on document.body instead of
   * absolutely inside this component. Needed inside scroll containers that clip
   * their overflow (the Edit Transaction modal's `overflow-y-auto` body would
   * otherwise cut the list off). Off by default so existing non-clipped usages
   * (which open the list upward in-flow) are unchanged.
   */
  usePortal?: boolean;
  /**
   * Category ids to leave out of the list — e.g. the category being DELETED
   * in the reassignment dialog must not be offered as its own replacement.
   */
  excludeIds?: string[];
  /**
   * Offer "Uncategorised" as a pinned first option (selects the blank
   * category, id ''), and let Delete/Backspace on the closed picker clear the
   * selection. For editors where a transaction may legitimately have no
   * category; OFF where a real category is required (split lines, the
   * delete-reassignment dialog).
   */
  allowClear?: boolean;
  /**
   * Trigger height.
   *
   * 'compact' matches the register quick-add dock's 32px fields — the default
   * 42px trigger stood taller than every neighbour in that bottom-aligned row
   * and floated its label above the others.
   *
   * 'row' is for a picker that IS a register cell: 36px, the height the row
   * being edited grows to, and text-sm so the category reads at the same size
   * in the cell as it did a moment ago when it was a word rather than a
   * picker. A 32px compact trigger sat 4px short of the fields beside it and
   * shrank the type as you started editing.
   */
  size?: 'default' | 'compact' | 'row';
  /**
   * Offer each GROUP itself as a choice ("All Food"), above its detail
   * categories. For budgets, where a limit on a whole group is the normal way
   * to plan and spending rolls the group's detail categories up. OFF
   * everywhere a transaction is being filed: a transaction belongs to a leaf.
   */
  allowGroupSelection?: boolean;
  /**
   * Offer the account "To/From <account>" categories as their own section, so
   * a line can say "this part of the money moved to another account" — the
   * Microsoft Money split leg.
   *
   * ONLY split-line pickers set this. A WHOLE transaction becomes a transfer
   * through the Type toggle, which creates both sides; offering a To/From
   * category as its category would be a second, contradictory way to say the
   * same thing.
   */
  includeTransferTargets?: boolean;
  /**
   * The account the transaction sits in. Its own To/From category is left out
   * of the transfer section — a transfer from an account to itself moves no
   * money and has no other side to create.
   */
  transferSourceAccountId?: string;
  /**
   * A pulse — any change to this number — asking the picker to open with an
   * empty search box and the cursor already in it.
   *
   * For a keyboard run down the register: Save & Next moves to the next
   * transaction and the user carries straight on typing the category, without
   * reaching for the mouse to open a list they were already in. A closed
   * combobox cannot be typed into, so "put the cursor in the category" and
   * "open the list" are one thing here rather than two.
   *
   * Zero (and absent) mean "nothing has been asked for", so a picker that
   * merely mounts with the prop wired up never opens itself.
   */
  openSearchToken?: number;
  /**
   * What Enter means on the CLOSED trigger.
   *
   * 'open' (the default) is the ARIA combobox convention and what every editor
   * in the app wants: Enter opens the list.
   *
   * 'pass-through' leaves Enter entirely alone so the surrounding form can act
   * on it. For the register's Quick Add row, where Enter is "add this
   * transaction" from every field (the Microsoft Money register) — a picker
   * that swallowed it would make one box in the row disagree with the other
   * four. Space and the arrow keys still open the list, so the picker is no
   * less operable from the keyboard.
   */
  closedEnter?: 'open' | 'pass-through';
}

/**
 * A key that types a character, as opposed to one that commands.
 *
 * Alt is excluded as well as Ctrl/Meta because a macOS Option chord produces a
 * one-character key ("¬", "ß") that the user meant as a shortcut, not a filter.
 */
const isPrintableKey = (e: React.KeyboardEvent): boolean =>
  e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

/**
 * Section id for the transfer targets. They hang off the Transfer type root as
 * ordinary detail categories, so they have no shared parent to group under —
 * and the heading wants to say what choosing one MEANS, not repeat the tree.
 */
const TRANSFER_SECTION_ID = '__transfer_targets__';
const TRANSFER_SECTION_NAME = 'Transfer to another account';

export default function CategorySelector({
  selectedCategory,
  onCategoryChange,
  transactionType,
  placeholder = "Select category...",
  className = "",
  allowCreate = true,
  includeAllTypes = false,
  showHelperText = true,
  usePortal = false,
  excludeIds,
  allowClear = false,
  size = 'default',
  allowGroupSelection = false,
  includeTransferTargets = false,
  transferSourceAccountId,
  openSearchToken,
  closedEnter = 'open',
}: CategorySelectorProps): React.JSX.Element {
  const { categories, addCategory, getSubCategories, getDetailCategories } = useApp();
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedParentId, setSelectedParentId] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const newCategoryInputRef = useRef<HTMLInputElement>(null);
  // Fixed coordinates for the portaled dropdown (usePortal mode only).
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);

  // Anchor the portaled menu to the trigger. Chooses up/down by available space
  // and recomputes on scroll/resize so it tracks the trigger inside a scrolling
  // modal body.
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
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
    });
  }, []);

  // Position (and keep positioning) the portaled menu while it is open.
  useLayoutEffect(() => {
    if (!usePortal || !showDropdown) {
      setMenuPos(null);
      return;
    }
    computeMenuPosition();
    const onReflow = () => computeMenuPosition();
    // Capture phase so it also fires for the scrolling modal body, not just window.
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [usePortal, showDropdown, computeMenuPosition]);

  // Get sub-categories for the transaction type
  const getSubCategoriesForType = (): Category[] => {
    // includeAllTypes: gather sub-categories under EVERY type tree (both
    // directions), for the quick-edit bar's cross-type list.
    if (includeAllTypes) {
      return categories
        .filter(cat => cat.level === 'type')
        .flatMap(tc => getSubCategories(tc.id))
        .filter(c => c.isActive !== false);
    }
    const typeCategory = categories.find(cat =>
      cat.level === 'type' && (cat.type === transactionType || cat.type === 'both')
    );
    // Inactive categories (a closed account's transfer category) never appear
    // in the picker; reopening the account restores them.
    return typeCategory
      ? getSubCategories(typeCategory.id).filter(c => c.isActive !== false)
      : [];
  };

  // Revaluation roots ("Revaluation") hold their leaves DIRECTLY — root →
  // detail, one rung shallower than income/expense's type → sub → detail —
  // so the walk below cannot see them and they are gathered separately.
  const getRevaluationRoots = (): Category[] =>
    categories.filter(c => c.level === 'type' && c.isRevaluationCategory === true);

  /**
   * Revaluation leaves (Market Value Change, Account Adjustment…), offered
   * whichever way the money points and whatever `transactionType` says: a
   * change in what an account is WORTH is neither income nor expense, so
   * direction has no bearing on whether it is the right filing.
   */
  const getRevaluationDetails = (): Category[] => {
    const details = getRevaluationRoots()
      .flatMap(root => getDetailCategories(root.id))
      .filter(c => c.isActive !== false);
    return excludeIds && excludeIds.length > 0
      ? details.filter(c => !excludeIds.includes(c.id))
      : details;
  };

  /**
   * The account "To/From <account>" categories, offered only where a line may
   * BE a transfer. A closed account's category is inactive and stays hidden;
   * the transaction's own account is left out (nothing moves).
   */
  const getTransferTargetDetails = (): Category[] => {
    if (!includeTransferTargets) return [];
    const targets = categories.filter(c =>
      c.isTransferCategory === true &&
      c.isActive !== false &&
      c.accountId !== undefined &&
      c.accountId !== transferSourceAccountId
    );
    return excludeIds && excludeIds.length > 0
      ? targets.filter(c => !excludeIds.includes(c.id))
      : targets;
  };

  /**
   * A transfer category is offered by `getTransferTargetDetails` and by NOTHING
   * ELSE — so the ordinary sub→detail walk drops them, always.
   *
   * Until this existed the exclusion was an ACCIDENT OF TREE SHAPE: the account
   * "To/From <account>" categories hang one rung shallower than an ordinary leaf
   * (detail directly under the Transfer type root, with no sub in between), so
   * the walk below happened not to reach them. That is a true statement about
   * today's tree, not a rule — re-parent one, or seed a tree with a sub in
   * between, and a picker with no business offering a transfer would start
   * offering it, with nothing in the code saying it should not.
   *
   * The rule is: filing a WHOLE transaction under a To/From category is a
   * second, contradictory way of saying what the Transfer type says properly
   * (and what creates both sides). So it is refused BY FLAG, here, where the
   * options are assembled.
   *
   * Unconditional rather than `includeTransferTargets ? …`, because the one
   * picker that DOES want them has its own source below — and that source
   * carries the rules that belong to a transfer target (the row's own account
   * left out, closed accounts hidden, its own heading, last). Letting them in
   * twice would list them twice, and would let the sub-walk smuggle in the one
   * the transfer section deliberately withholds.
   */
  const withoutTransferTargets = (list: Category[]): Category[] =>
    list.filter(c => c.isTransferCategory !== true);

  // Get all detail categories for the transaction type
  const getAllDetailCategories = (): Category[] => {
    const subCategories = getSubCategoriesForType();
    const detailCategories: Category[] = [];

    subCategories.forEach(subCat => {
      // Inactive DETAIL categories (a closed account's To/From) stay hidden,
      // same as inactive subs — reopening the account restores them.
      const details = withoutTransferTargets(getDetailCategories(subCat.id).filter(d => d.isActive !== false));
      detailCategories.push(...details);
    });

    detailCategories.push(...getRevaluationDetails());
    detailCategories.push(...getTransferTargetDetails());

    return excludeIds && excludeIds.length > 0
      ? detailCategories.filter(c => !excludeIds.includes(c.id))
      : detailCategories;
  };

  // Filter categories based on search term
  const getFilteredOptions = (): Category[] => {
    const allDetails = getAllDetailCategories();

    if (!searchTerm) {
      return allDetails;
    }

    return allDetails.filter(cat =>
      cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getParentCategoryName(cat.id).toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // Group the search-filtered detail categories under their parent sub-category
  // (Bills, Food, Personal…), preserving sub-category order — the dropdown shows
  // titled sections instead of a flat list, while search still filters items.
  const getGroupedOptions = (): Array<{
    id: string;
    name: string;
    items: Category[];
    /** Whether the group HEADING is itself a choice ("All Food"). */
    selectable: boolean;
  }> => {
    const matchedIds = new Set(getFilteredOptions().map(c => c.id));
    const groupMatchesSearch = (name: string): boolean =>
      allowGroupSelection && name.toLowerCase().includes(searchTerm.toLowerCase());
    const groups = getSubCategoriesForType()
      .map(sub => ({
        id: sub.id,
        name: sub.name,
        // Filtered for the same reason as in getAllDetailCategories: what a
        // section SHOWS and what the keyboard can reach must be the same list,
        // or an option exists that only the arrow keys can find.
        items: withoutTransferTargets(getDetailCategories(sub.id)).filter(d => matchedIds.has(d.id)),
        selectable: allowGroupSelection,
      }))
      // A group with no (matching) leaves still belongs in the list when the
      // group ITSELF can be chosen and the search names it.
      .filter(group => group.items.length > 0 || groupMatchesSearch(group.name));
    // Revaluation last, under its own heading: the third kind of movement,
    // read after the everyday ones rather than mixed in with them.
    const revaluationGroups = getRevaluationRoots()
      .map(root => ({
        id: root.id,
        name: root.name,
        items: getDetailCategories(root.id).filter(d => matchedIds.has(d.id)),
        selectable: allowGroupSelection,
      }))
      .filter(group => group.items.length > 0);
    // Transfers last of all, and never selectable as a group: "transfer" is
    // not a category anything can be filed under — only a specific account is.
    const transferItems = getTransferTargetDetails().filter(c => matchedIds.has(c.id));
    const transferGroups = transferItems.length > 0
      ? [{ id: TRANSFER_SECTION_ID, name: TRANSFER_SECTION_NAME, items: transferItems, selectable: false }]
      : [];
    return [...groups, ...revaluationGroups, ...transferGroups];
  };

  // Get parent category name for display
  const getParentCategoryName = (categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    if (!category?.parentId) return '';

    const parent = categories.find(c => c.id === category.parentId);
    return parent?.name || '';
  };

  // Get full category display name
  const getCategoryDisplayName = (categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return '';

    // A chosen GROUP reads as the whole group ("All Food"), never as
    // "Expenses > Food" — the parent of a group is the direction, which tells
    // the reader nothing.
    if (allowGroupSelection && category.level === 'sub') {
      return `All ${category.name}`;
    }

    const parentName = getParentCategoryName(categoryId);
    return parentName ? `${parentName} > ${category.name}` : category.name;
  };

  // Get selected category display name
  const getSelectedCategoryName = (): string => {
    if (!selectedCategory) return '';
    return getCategoryDisplayName(selectedCategory);
  };

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // The portaled menu lives outside dropdownRef, so check it separately —
      // otherwise a click on a list item would count as "outside" and close the
      // menu before the option's onClick could fire.
      const inTrigger = dropdownRef.current?.contains(target) ?? false;
      const inMenu = menuRef.current?.contains(target) ?? false;
      if (!inTrigger && !inMenu) {
        setShowDropdown(false);
        setSearchTerm('');
        setShowCreateForm(false);
        setNewCategoryName('');
        setSelectedParentId('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // The search box takes the keyboard the moment the list opens, with the caret
  // AFTER whatever seeded it. Opening by typing a character puts that character
  // in the box, and a browser that parked the caret at position 0 would send
  // the next keystroke in front of it — "gr" typed, "rg" filtered. Keyed on
  // showDropdown alone so it runs once per opening and never fights the caret
  // afterwards.
  useEffect(() => {
    if (!showDropdown) return;
    const el = searchInputRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }, [showDropdown]);

  // Auto-focus the new category name input when create form opens
  useEffect(() => {
    if (showCreateForm && newCategoryInputRef.current) {
      newCategoryInputRef.current.focus();
    }
  }, [showCreateForm]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
    setShowDropdown(true);
  };

  const handleInputFocus = (): void => {
    setShowDropdown(true);
  };

  // Internal stand-in id for the "Uncategorised" option — the real value is
  // '' (blank category), but '' is falsy and would fall through the
  // highlight/activedescendant logic.
  const UNCATEGORISED_ID = '__uncategorised__';

  const handleCategorySelect = (categoryId: string): void => {
    onCategoryChange(categoryId === UNCATEGORISED_ID ? '' : categoryId);
    setShowDropdown(false);
    setSearchTerm('');
  };

  const handleInputClick = (): void => {
    setShowDropdown(!showDropdown);
  };

  // A caller asking for the cursor (see openSearchToken). The search input is
  // autoFocused as it mounts, so opening the list IS handing over the keyboard.
  //
  // ONLY ON A CHANGE, NEVER ON A MOUNT. An effect with dependencies still runs
  // once when the component mounts, and `if (!openSearchToken) return` only
  // covers a token that is still zero — so a picker mounting with an already
  // raised token opened itself, which is the exact thing the prop's contract
  // above promises it will not do.
  //
  // That was invisible until the counter had been raised once. The register's
  // editor never unmounts and never resets the token, and it rebuilds the
  // picker on every Save & Next hop — so ONE landing on the category field
  // latched it, and from then on every hop, whatever field the user was
  // actually working in, mounted a picker that opened itself and took the
  // keyboard. Because the search box is autoFocused in a LATER commit than the
  // editor's own focus call, category always won. Hence the owner's report: a
  // run down the notes column that keeps arriving in the category picker, but
  // "not every time" — it is a latch, not a race, and a fresh page was well
  // behaved until the first category landing tripped it.
  //
  // Comparing against the last token this picker acted on is what makes a
  // rebuild indistinguishable from having never left.
  const handledSearchToken = useRef(openSearchToken ?? 0);
  useEffect(() => {
    const token = openSearchToken ?? 0;
    if (token === handledSearchToken.current) return;
    handledSearchToken.current = token;
    if (!token) return;
    setSearchTerm('');
    setShowDropdown(true);
  }, [openSearchToken]);

  // ── Keyboard support (combobox pattern) ────────────────────────────────────
  // The native <select> this component replaced was fully keyboard-operable;
  // this restores that: Enter/Space/arrows open the picker, arrows walk the
  // filtered options, Enter selects, Escape closes and returns focus.
  const instanceId = useId();
  const listboxId = `${instanceId}-listbox`;
  const optionDomId = (categoryId: string): string => `${instanceId}-opt-${categoryId}`;
  const [highlightIndex, setHighlightIndex] = useState(-1);

  // Any change to the option list invalidates the highlight.
  useEffect(() => {
    setHighlightIndex(-1);
  }, [showDropdown, searchTerm]);

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
    } else if (allowClear && selectedCategory && (e.key === 'Delete' || e.key === 'Backspace')) {
      // Money-style: clearing the category un-categorises the transaction.
      e.preventDefault();
      onCategoryChange('');
    } else if (isPrintableKey(e)) {
      // Typing IS the way people use a picker: the control this replaced was a
      // native <select>, where the first letter jumped straight to it. Tabbing
      // in and typing used to do nothing at all — the list had to be opened
      // first, which nobody can guess. Now the character that opened the list
      // is also the first character of the filter, so nothing is retyped.
      //
      // Space is caught above and opens with an EMPTY search: a leading space
      // filters nothing and would only make the list look broken.
      e.preventDefault();
      setSearchTerm(e.key);
      setShowDropdown(true);
    }
  };

  const handleSearchKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    flatOptions: Array<Pick<Category, 'id' | 'name'>>
  ): void => {
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
        /*
         * ─ ENTER AFTER TYPING CHOOSES THE TOP MATCH ────────────────────────
         *
         * It used to choose the highlighted option, or the only option if the
         * filter had left exactly one, and OTHERWISE NOTHING AT ALL — while
         * `preventDefault` above swallowed the keystroke, so the row looked as
         * though it had accepted a category it had not.
         *
         * That is unreachable with a mouse and unavoidable with the keyboard,
         * because the highlight is reset to -1 on every change to `searchTerm`
         * (see the effect beside it: "any change to the option list invalidates
         * the highlight"). So typing a filter ALWAYS left nothing highlighted,
         * and unless the text happened to narrow the list to one, Enter was a
         * key that did nothing and said nothing.
         *
         * The owner found the difference by doing the same edit twice: "the
         * only difference this time to what I did before is I pressed next &
         * save with the mouse and last time I was typing the category and then
         * pressing enter > enter."
         *
         * With a search term the first option is the best match by the list's
         * own ordering, so it is what Enter means. With NO search term there is
         * no match to be top of — the list is simply every category — and
         * silently filing the alphabetically-first one would be worse than
         * doing nothing, so the old behaviour stands there.
         */
        const chosen = flatOptions[highlightIndex]
          ?? (searchTerm.trim() !== '' || flatOptions.length === 1 ? flatOptions[0] : undefined);
        if (chosen) handleCategorySelect(chosen.id);
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

  // Keep the highlighted option scrolled into view while arrowing.
  useEffect(() => {
    if (highlightIndex < 0) return;
    const el = document.querySelector(`[data-highlighted-option="${instanceId}"]`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [highlightIndex, instanceId]);

  const handleCreateCategory = async (): Promise<void> => {
    if (!newCategoryName.trim() || !selectedParentId) return;

    const newCategory: Omit<Category, 'id'> = {
      name: newCategoryName.trim(),
      type: transactionType === 'transfer' ? 'both' : transactionType,
      level: 'detail',
      parentId: selectedParentId,
    };

    try {
      // addCategory returns the created row — select its REAL id directly.
      // (The old name-lookup-after-a-tick read a stale closure and its fallback
      // selected an id that was never persisted, filing the transaction under a
      // category that doesn't exist.)
      const created = await addCategory(newCategory);
      onCategoryChange(created.id);
    } catch {
      // addCategory already logs; leave the current selection unchanged.
    }

    // Reset and close
    setNewCategoryName('');
    setSelectedParentId('');
    setShowCreateForm(false);
    setShowDropdown(false);
    setSearchTerm('');
  };

  const subCategories = getSubCategoriesForType();
  const groupedOptions = getGroupedOptions();
  // "Uncategorised" stays visible while the search could still mean it
  // ('' matches everything, "unc" matches, "food" hides it).
  const showClearOption = allowClear && 'uncategorised'.includes(searchTerm.toLowerCase());
  // Flat view of the visible options, in render order — what the arrow keys
  // walk. With group selection on, each group's own option leads its items,
  // exactly as they are drawn.
  const flatOptions: Array<Pick<Category, 'id' | 'name'>> = [
    ...(showClearOption ? [{ id: UNCATEGORISED_ID, name: 'Uncategorised' }] : []),
    ...groupedOptions.flatMap(g =>
      g.selectable
        ? [{ id: g.id, name: `All ${g.name}` }, ...g.items]
        : g.items
    ),
  ];
  const highlightedId = highlightIndex >= 0 ? flatOptions[highlightIndex]?.id : undefined;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <div
          ref={triggerRef}
          tabIndex={0}
          role="combobox"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-controls={showDropdown ? listboxId : undefined}
          aria-label="Category"
          onKeyDown={handleTriggerKeyDown}
          className={`w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-sm cursor-text flex items-center ${
            size === 'compact'
              ? 'px-2.5 py-1.5 h-auto sm:h-[32px] text-xs rounded-lg'
              : size === 'row'
              ? 'px-2 h-[36px] text-sm font-normal rounded-lg'
              : 'px-3 py-2 h-[42px] rounded-xl'
          }`}
          onClick={handleInputClick}
        >
          <div className="flex w-full min-w-0 items-center justify-between gap-1">
            <div className="flex-1 min-w-0">
              {showDropdown ? (
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={handleInputChange}
                  onFocus={handleInputFocus}
                  onKeyDown={(e) => handleSearchKeyDown(e, flatOptions)}
                  // Filtering a list of the user's own category names.
                  spellCheck={false}
                  autoCapitalize="none"
                  placeholder={placeholder}
                  aria-autocomplete="list"
                  aria-controls={listboxId}
                  aria-activedescendant={highlightedId ? optionDomId(highlightedId) : undefined}
                  className="w-full bg-transparent text-gray-900 dark:text-white !border-0 focus:!outline-none focus-visible:!outline-none"
                  autoFocus
                />
              ) : (
                <FitLabel
                  text={selectedCategory ? getSelectedCategoryName() : placeholder}
                  muted={!selectedCategory}
                />
              )}
            </div>
            <ChevronDownIcon
              size={16}
              className={`text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
            />
          </div>
        </div>

        {/* Dropdown — in-flow (opens upward) by default, or a fixed-position
            portal on document.body when usePortal escapes a clipping modal. */}
        {showDropdown && (() => {
          const menu = (
          <div
            ref={usePortal ? menuRef : undefined}
            id={listboxId}
            role="listbox"
            style={usePortal && menuPos ? {
              position: 'fixed',
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
              zIndex: 9999,
              ...(menuPos.top !== undefined ? { top: menuPos.top } : { bottom: menuPos.bottom }),
            } : undefined}
            className={usePortal
              ? 'overflow-y-auto bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg'
              : 'absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50'}
          >
            {showCreateForm ? (
              /* Create New Category Form */
              <div className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                    title="Back to categories"
                  >
                    <ArrowLeftIcon size={16} className="text-gray-500" />
                  </button>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Add New Category
                  </span>
                </div>

                {/* Category Name */}
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Category Name
                  </label>
                  <input
                    ref={newCategoryInputRef}
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. Gym Membership"
                    className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateCategory();
                      }
                    }}
                  />
                </div>

                {/* Parent Category */}
                <div className="mb-2">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Add under
                  </label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {subCategories.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setSelectedParentId(sub.id)}
                        className={`w-full text-left px-2.5 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                          selectedParentId === sub.id
                            ? 'bg-[#1a2332]/10 text-primary border border-[#1a2332]/30'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {selectedParentId === sub.id && <CheckIcon size={14} />}
                        <span>{sub.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Create Button */}
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={!newCategoryName.trim() || !selectedParentId}
                  className="w-full px-3 py-1.5 text-sm bg-[#1a2332] text-white rounded-lg hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <PlusIcon size={14} />
                  Add Category
                </button>
              </div>
            ) : (
              <>
                {/* Un-categorise: pinned above the groups; selecting it blanks
                    the category (the transaction moves to the virtual
                    Uncategorised bucket). */}
                {showClearOption && (
                  <div
                    id={optionDomId(UNCATEGORISED_ID)}
                    role="option"
                    aria-selected={selectedCategory === ''}
                    data-highlighted-option={highlightedId === UNCATEGORISED_ID ? instanceId : undefined}
                    className={`px-3 py-2 cursor-pointer border-b border-gray-100 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 ${
                      highlightedId === UNCATEGORISED_ID ? 'bg-gray-100 dark:bg-gray-600' : ''
                    }`}
                    onClick={() => handleCategorySelect(UNCATEGORISED_ID)}
                  >
                    <span className="italic text-gray-500 dark:text-gray-400">Uncategorised</span>
                  </div>
                )}
                {/* Category list — grouped under their parent sub-category
                    (Bills, Food, Personal…) with sticky section headers. */}
                {groupedOptions.length > 0 ? (
                  groupedOptions.map((group) => (
                    <div key={group.id}>
                      {/* Same darker group-header treatment as the Accounts
                          sections — one scheme for every grouping band. */}
                      <div className="sticky top-0 z-10 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-500 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        {group.name}
                      </div>
                      {/* The group as a choice in its own right, above its
                          leaves — a budget on "Food" covers everything under
                          it. Only rendered where groups are selectable. */}
                      {group.selectable && (
                        <div
                          id={optionDomId(group.id)}
                          role="option"
                          aria-selected={selectedCategory === group.id}
                          data-highlighted-option={highlightedId === group.id ? instanceId : undefined}
                          /* The chosen option takes the selection wash
                             (stock-blue ruling, 28 Aug 2026). Dark needs its
                             own value — `--color-primary` does not invert —
                             and it has to sit BETWEEN the list's gray-700
                             ground and the gray-600 the keyboard highlight
                             already owns, or selected and highlighted stop
                             being two different things. */
                          className={`px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${
                            highlightedId === group.id
                              ? 'bg-gray-100 dark:bg-gray-600'
                              : selectedCategory === group.id
                              ? 'bg-primary/10 dark:bg-gray-600/50'
                              : ''
                          }`}
                          onClick={() => handleCategorySelect(group.id)}
                        >
                          <div className="flex items-center gap-2">
                            <TagIcon size={14} className="text-gray-400 shrink-0" />
                            <span className="font-medium text-gray-900 dark:text-white">
                              All {group.name}
                            </span>
                          </div>
                        </div>
                      )}
                      {group.items.map((category) => (
                        <div
                          key={category.id}
                          id={optionDomId(category.id)}
                          role="option"
                          aria-selected={selectedCategory === category.id}
                          data-highlighted-option={highlightedId === category.id ? instanceId : undefined}
                          className={`px-3 py-2 pl-8 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${
                            highlightedId === category.id
                              ? 'bg-gray-100 dark:bg-gray-600'
                              : selectedCategory === category.id
                              ? 'bg-primary/10 dark:bg-gray-600/50'
                              : ''
                          }`}
                          onClick={() => handleCategorySelect(category.id)}
                        >
                          <div className="flex items-center gap-2">
                            <TagIcon size={14} className="text-gray-400 shrink-0" />
                            <span className="font-medium text-gray-900 dark:text-white">
                              {category.name}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                ) : showClearOption ? null : (
                  <div className="px-3 py-2 text-gray-500 dark:text-gray-400 text-center">
                    {searchTerm ? 'No categories found' : 'No categories available'}
                  </div>
                )}

                {/* Add New Category Option */}
                {allowCreate && (
                  <div className="border-t border-gray-200 dark:border-gray-600">
                    <div
                      className="px-3 py-2.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-primary"
                      onClick={() => {
                        setShowCreateForm(true);
                        if (searchTerm) {
                          setNewCategoryName(searchTerm);
                          setSearchTerm('');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <PlusIcon size={14} />
                        <span className="font-medium text-sm">Add New Category</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          );
          if (!usePortal) return menu;
          return menuPos ? createPortal(menu, document.body) : null;
        })()}
      </div>

      {/* Helper Text */}
      {showHelperText && !selectedCategory && !showDropdown && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Select a category for this {transactionType} transaction
        </p>
      )}
    </div>
  );
}
