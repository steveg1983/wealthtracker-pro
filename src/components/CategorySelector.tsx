import { useState, useRef, useEffect, useLayoutEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../contexts/AppContextSupabase';
import type { Category } from '../types';
import { ChevronDownIcon, TagIcon, PlusIcon, ArrowLeftIcon, CheckIcon } from './icons';

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
}

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

  // Get all detail categories for the transaction type
  const getAllDetailCategories = (): Category[] => {
    const subCategories = getSubCategoriesForType();
    const detailCategories: Category[] = [];

    subCategories.forEach(subCat => {
      const details = getDetailCategories(subCat.id);
      detailCategories.push(...details);
    });

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
  const getGroupedOptions = (): Array<{ id: string; name: string; items: Category[] }> => {
    const matchedIds = new Set(getFilteredOptions().map(c => c.id));
    return getSubCategoriesForType()
      .map(sub => ({
        id: sub.id,
        name: sub.name,
        items: getDetailCategories(sub.id).filter(d => matchedIds.has(d.id)),
      }))
      .filter(group => group.items.length > 0);
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

  const handleCategorySelect = (categoryId: string): void => {
    onCategoryChange(categoryId);
    setShowDropdown(false);
    setSearchTerm('');
  };

  const handleInputClick = (): void => {
    setShowDropdown(!showDropdown);
  };

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
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setShowDropdown(true);
    }
  };

  const handleSearchKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    flatOptions: Category[]
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
        const chosen = flatOptions[highlightIndex] ??
          (flatOptions.length === 1 ? flatOptions[0] : undefined);
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
  // Flat view of the visible options, in render order — what the arrow keys walk.
  const flatOptions = groupedOptions.flatMap(g => g.items);
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
          className="w-full px-3 py-2 h-[42px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm cursor-text flex items-center"
          onClick={handleInputClick}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {showDropdown ? (
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleInputChange}
                  onFocus={handleInputFocus}
                  onKeyDown={(e) => handleSearchKeyDown(e, flatOptions)}
                  placeholder={placeholder}
                  aria-autocomplete="list"
                  aria-controls={listboxId}
                  aria-activedescendant={highlightedId ? optionDomId(highlightedId) : undefined}
                  className="w-full bg-transparent text-gray-900 dark:text-white !border-0 focus:!outline-none focus-visible:!outline-none"
                  autoFocus
                />
              ) : (
                <span className={`block ${selectedCategory ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                  {selectedCategory ? getSelectedCategoryName() : placeholder}
                </span>
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
                    className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary dark:text-white"
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
                            ? 'bg-[#1a2332]/10 text-primary border border-primary/30'
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
                {/* Category list — grouped under their parent sub-category
                    (Bills, Food, Personal…) with sticky section headers. */}
                {groupedOptions.length > 0 ? (
                  groupedOptions.map((group) => (
                    <div key={group.id}>
                      <div className="sticky top-0 z-10 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {group.name}
                      </div>
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
                              ? 'bg-blue-50 dark:bg-blue-900/20'
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
                ) : (
                  <div className="px-3 py-2 text-gray-500 dark:text-gray-400 text-center">
                    {searchTerm ? 'No categories found' : 'No categories available'}
                  </div>
                )}

                {/* Add New Category Option */}
                {allowCreate && (
                  <div className="border-t border-gray-200 dark:border-gray-600">
                    <div
                      className="px-3 py-2.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-primary dark:text-blue-400"
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
