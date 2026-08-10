import { useState, useMemo } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useToast } from '../../contexts/ToastContext';
import { DEFAULT_CATEGORY_TREE } from '../../data/defaultCategoryTree';
import { expandSplitTransactions } from '../../utils/transactionSplits';
import CategoryCreationModal from '../../components/CategoryCreationModal';
import EditCategoryModal from '../../components/EditCategoryModal';
import CategorySelector from '../../components/CategorySelector';
import CategoryTransactionsModal from '../../components/CategoryTransactionsModal';
import CategoryDataHealthPanel from '../../components/CategoryDataHealthPanel';
import { computeCategoryHealth } from '../../utils/categoryHealth';
import { ARRIVAL_ROW_CLASS, useArrivalRowFocus } from '../../hooks/useArrivalFocus';
import { AlertCircleIcon, Settings2Icon, GripVerticalIcon, MergeIcon } from '../../components/icons';
import { PlusIcon, ChevronRightIcon, ChevronDownIcon, DeleteIcon } from '../../components/icons';
import type { Category as AppCategory, CategoryMergeResult } from '../../types';
import { IconButton } from '../../components/icons/IconButton';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import PageWrapper from '../../components/PageWrapper';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  level: 'type' | 'sub' | 'detail';
  parentId?: string;
  color?: string;
  icon?: string;
  isSystem?: boolean;
  order?: number;
}

/**
 * Why this category cannot be merged away — the sentence the user sees — or
 * null when it can be. Mirrors the merge_categories RPC's refusals
 * (20260805214322) so an ineligible row explains itself BEFORE the round trip
 * rather than after it.
 *
 * v1 is leaf-to-leaf: the affordance is offered on detail categories only, and
 * a group says so instead of being silently absent.
 */
function mergeBlockedReason(category: AppCategory, categories: AppCategory[]): string | null {
  if (category.isTransferCategory === true) {
    return 'Transfer categories are managed automatically from their account. Close the account to hide it instead.';
  }
  if (category.isRevaluationCategory === true || category.isSystem === true) {
    return 'The app files transactions under this built-in category automatically, so it cannot be merged away.';
  }
  if (category.isUnassignedBucket === true) {
    return "Rows here aren't categorised at all — file them from the review band rather than merging the whole bucket into a real category.";
  }
  if (category.level !== 'detail' || categories.some(c => c.parentId === category.id)) {
    return "Merging a whole group isn't supported yet — merge the detail categories inside it instead.";
  }
  return null;
}

interface SortableCategoryProps {
  category: Category;
  isEditMode: boolean;
  isDeleteMode: boolean;
  isMergeMode: boolean;
  /** Set when merge mode is on and this row cannot be merged; the row dims and says why. */
  mergeBlockedReason?: string | null;
  /** True for a row the data-health panel has just pointed at. */
  isHighlighted?: boolean;
  /** Put on the ONE highlighted row that should scroll itself into view. */
  highlightRef?: (node: HTMLElement | null) => void;
  onEdit: () => void;
  onDelete: () => void;
  onMerge: () => void;
  onClick?: () => void;
  children?: React.ReactNode;
  isDraggable?: boolean;
}

function SortableCategory({
  category,
  isEditMode,
  isDeleteMode,
  isMergeMode,
  mergeBlockedReason: mergeBlocked,
  isHighlighted = false,
  highlightRef,
  onEdit,
  onDelete,
  onMerge,
  onClick,
  children,
  isDraggable = true
}: SortableCategoryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: category.id,
    disabled: !isEditMode || !isDraggable || isDeleteMode || isMergeMode
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // In merge mode an ineligible row is dimmed and carries its reason as a
  // tooltip — visibly off rather than missing, so the tree still reads as the
  // whole tree. Clicking it says the same thing out loud (a toast), because a
  // title attribute is no use on a touch screen.
  const mergeUnavailable = isMergeMode && mergeBlocked != null;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        ref={highlightRef}
        // `aria-current` rather than colour alone: a row the panel pointed at
        // is "the one you asked for", and that has to reach a screen reader as
        // well as an eye. Same tint as a drill-down arrival elsewhere in the
        // app (hooks/useArrivalFocus), so being landed on always looks the same.
        aria-current={isHighlighted ? 'true' : undefined}
        className={`flex items-center justify-between p-2 rounded ${
          isDragging ? 'opacity-50' : ''
        } ${mergeUnavailable ? 'opacity-60' : ''} ${
          isHighlighted ? ARRIVAL_ROW_CLASS : ''
        } ${
          isEditMode ? 'hover:bg-gray-100 dark:hover:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
      >
        <div className="flex items-center gap-2 flex-1">
          {isEditMode && isDraggable && (
            <div {...attributes} {...listeners} className="cursor-move text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
              <GripVerticalIcon size={16} />
            </div>
          )}
          {!isEditMode && !isDraggable && <span className="w-4" />}
          <div
            title={
              mergeUnavailable
                ? mergeBlocked ?? undefined
                : isMergeMode
                  ? `Merge "${category.name}" into another category`
                  : isEditMode
                    ? `Edit "${category.name}"`
                    : undefined
            }
            className={`flex items-center gap-2 flex-1 ${
              mergeUnavailable
                ? 'cursor-not-allowed'
                : isMergeMode || (!isEditMode && !isDeleteMode && onClick)
                  ? 'cursor-pointer'
                  : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (isMergeMode) {
                onMerge();
              } else if (isDeleteMode) {
                onDelete();
              } else if (isEditMode) {
                onEdit();
              } else if (onClick) {
                onClick();
              }
            }}
          >
            <span className={`${category.level === 'sub' ? 'font-medium' : ''} text-gray-900 dark:text-white ${
              mergeUnavailable ? '' :
              isMergeMode ? 'hover:text-primary dark:hover:text-primary' :
              isDeleteMode ? 'hover:text-red-600 dark:hover:text-red-400' :
              'hover:text-primary dark:hover:text-primary'
            }`}>
              {category.name}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">{children}</div>
      </div>
    </div>
  );
}

/** "1,240 transactions, 12 split lines and 1 budget" — zero counts say nothing. */
function movingClause(transactions: number, splitLines: number, budgets: number): string {
  const parts: string[] = [];
  if (transactions > 0) {
    parts.push(`${transactions.toLocaleString()} transaction${transactions === 1 ? '' : 's'}`);
  }
  if (splitLines > 0) {
    parts.push(`${splitLines.toLocaleString()} split line${splitLines === 1 ? '' : 's'}`);
  }
  if (budgets > 0) {
    parts.push(`${budgets.toLocaleString()} budget${budgets === 1 ? '' : 's'}`);
  }
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export default function CategoriesSettings() {
  const {
    transactions,
    categories,
    budgets,
    transactionSplits,
    updateCategory,
    deleteCategory,
    mergeCategories,
    getSubCategories,
    getDetailCategories,
    importCategoryTree
  } = useApp();
  const { showSuccess, showError } = useToast();
  const [isImporting, setIsImporting] = useState(false);

  // Split parents expand into their per-line virtual rows so a split line
  // counts under ITS category, not nowhere (the parent's category is blank).
  const expandedTransactions = useMemo(
    () => expandSplitTransactions(transactions, transactionSplits),
    [transactions, transactionSplits]
  );

  // Transaction count per category id (split lines included), computed once
  // per data change. Every row shows its counter (view AND edit/delete
  // modes) — the old per-row transactions.filter() was O(rows × transactions)
  // at 16k+ transactions.
  const categoryTransactionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of expandedTransactions) {
      if (t.category) {
        counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
      }
    }
    return counts;
  }, [expandedTransactions]);

  // Where the category data is weak — uncategorised rows, import buckets,
  // dangling references, empty categories. Shares the reports' classifier and
  // split expansion so the numbers agree with the report band this points at.
  const categoryHealth = useMemo(
    () => computeCategoryHealth(transactions, transactionSplits, categories),
    [transactions, transactionSplits, categories]
  );

  // The type-level ids are user-specific UUIDs after cloud migration — the old
  // hardcoded 'type-income'/'type-expense'/'type-transfer' anchors matched
  // nothing, which rendered every section empty. Resolve them dynamically.
  const typeAnchorIds = useMemo(() => ({
    income: categories.find(c => c.level === 'type' && c.type === 'income')?.id ?? 'type-income',
    expense: categories.find(c => c.level === 'type' && c.type === 'expense')?.id ?? 'type-expense',
    transfer: categories.find(c => c.level === 'type' && c.type === 'both')?.id ?? 'type-transfer',
  }), [categories]);

  const handleImportDefaultSet = async () => {
    if (isImporting) return;
    if (!window.confirm(
      'Switch to the standard starter category set? The default tree is imported and unused default categories are removed. Categories that transactions use, transfer categories, and system categories are always kept.'
    )) {
      return;
    }
    setIsImporting(true);
    try {
      const result = await importCategoryTree(DEFAULT_CATEGORY_TREE, { pruneOthers: true });
      const parts: string[] = [];
      if (result.created > 0) parts.push(`added ${result.created}`);
      if (result.pruned > 0) parts.push(`removed ${result.pruned} unused defaults`);
      if (result.keptForTransactions > 0) parts.push(`kept ${result.keptForTransactions} in use by transactions`);
      showSuccess(
        parts.length > 0
          ? `Categories updated: ${parts.join(', ')}.`
          : 'Your categories already match the standard starter set.',
        'Starter set applied'
      );
    } catch (error) {
      showError(error);
    } finally {
      setIsImporting(false);
    }
  };
  

  const [isEditMode, setIsEditMode] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignCategoryId, setReassignCategoryId] = useState<string>('');
  const [mergingCategoryId, setMergingCategoryId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [isMerging, setIsMerging] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<{ [parentId: string]: string[] }>({});
  const [viewingCategoryId, setViewingCategoryId] = useState<string | null>(null);
  const [viewingCategoryName, setViewingCategoryName] = useState<string>('');
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  /**
   * The rows the data-health panel has just pointed at, and a token that
   * changes on every ask so the same rows can be scrolled to twice. Null until
   * the user asks — nothing about this page changes for anyone who doesn't.
   */
  const [emptyHighlight, setEmptyHighlight] = useState<{
    ids: Set<string>;
    /** The one that scrolls itself into view. */
    firstId: string;
    token: string;
  } | null>(null);
  // Only the FIRST of them scrolls: dragging the view to each in turn would
  // land on the last one, which is not the one being introduced.
  const { focusRef: scrollHighlightIntoView } = useArrivalRowFocus(emptyHighlight?.token ?? null);

  // Initialize category order from existing categories
  useState(() => {
    const order: { [parentId: string]: string[] } = {};
    
    // Get all parent categories
    const parentIds = [...new Set(categories.map(c => c.parentId).filter(Boolean))];
    
    parentIds.forEach(parentId => {
      if (parentId) {
        order[parentId] = categories
          .filter(c => c.parentId === parentId)
          .map(c => c.id);
      }
    });
    
    setCategoryOrder(order);
    return null;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleCategoryExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    
    if (!over || active.id === over.id) return;

    const activeCategory = categories.find(c => c.id === active.id);
    const overCategory = categories.find(c => c.id === over.id);

    if (!activeCategory || !overCategory) return;

    // Transfer categories are system-managed structure — dragging one under an
    // income/expense sub (or dropping a normal category onto one) would
    // corrupt the tree in a way the rename/delete guards can't repair.
    if (activeCategory.isTransferCategory || overCategory.isTransferCategory) {
      if (activeCategory.parentId !== overCategory.parentId || activeCategory.level !== overCategory.level) {
        showError(new Error(
          'Transfer categories are managed automatically from their account and cannot be moved.'
        ));
        return;
      }
    }

    // Handle reordering within the same parent
    if (activeCategory.parentId === overCategory.parentId && activeCategory.level === overCategory.level) {
      const parentId = activeCategory.parentId || '';
      const currentOrder = categoryOrder[parentId] || [];
      
      const oldIndex = currentOrder.indexOf(active.id as string);
      const newIndex = currentOrder.indexOf(over.id as string);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
        setCategoryOrder(prev => ({
          ...prev,
          [parentId]: newOrder
        }));
      }
      return;
    }

    // Handle detail category being dropped on a subcategory (change parent)
    if (activeCategory.level === 'detail' && overCategory.level === 'sub') {
      // Check if the subcategory can accept this type of category
      if (activeCategory.type === overCategory.type || activeCategory.type === 'both' || overCategory.type === 'both') {
        updateCategory(active.id as string, { parentId: over.id as string });
        
        // Update order for both old and new parent
        const oldParentId = activeCategory.parentId || '';
        const newParentId = over.id as string;
        
        // Remove from old parent order
        if (categoryOrder[oldParentId]) {
          setCategoryOrder(prev => ({
            ...prev,
            [oldParentId]: prev[oldParentId].filter(id => id !== active.id)
          }));
        }
        
        // Add to new parent order
        setCategoryOrder(prev => ({
          ...prev,
          [newParentId]: [...(prev[newParentId] || []), active.id as string]
        }));
      }
      return;
    }

    // Handle detail category being dropped on another detail category (move to same parent)
    if (activeCategory.level === 'detail' && overCategory.level === 'detail' && activeCategory.parentId !== overCategory.parentId) {
      // Move to the same parent as the category it was dropped on
      updateCategory(active.id as string, { parentId: overCategory.parentId });
      
      // Update order for both old and new parent
      const oldParentId = activeCategory.parentId || '';
      const newParentId = overCategory.parentId || '';
      
      // Remove from old parent order
      if (categoryOrder[oldParentId]) {
        setCategoryOrder(prev => ({
          ...prev,
          [oldParentId]: prev[oldParentId].filter(id => id !== active.id)
        }));
      }
      
      // Add to new parent order at the position after the target
      const targetIndex = categoryOrder[newParentId]?.indexOf(over.id as string) || 0;
      setCategoryOrder(prev => ({
        ...prev,
        [newParentId]: [
          ...(prev[newParentId] || []).slice(0, targetIndex + 1),
          active.id as string,
          ...(prev[newParentId] || []).slice(targetIndex + 1).filter(id => id !== active.id)
        ]
      }));
      return;
    }

    // Handle subcategory being moved between income/expense sections
    if (activeCategory.level === 'sub' && overCategory.level === 'sub') {
      // Check if they have different parent types
      const activeParent = categories.find(c => c.id === activeCategory.parentId);
      const overParent = categories.find(c => c.id === overCategory.parentId);
      
      if (activeParent && overParent && activeParent.id !== overParent.id) {
        // Move subcategory to new parent type. Compare against the RESOLVED
        // anchor ids — cloud-migrated anchors are UUIDs, so matching the old
        // literal 'type-income'/'type-expense' always fell through to 'both'
        // and silently corrupted the category's type on cross-section drags.
        updateCategory(active.id as string, {
          parentId: overParent.id,
          type: overParent.id === typeAnchorIds.income
            ? 'income'
            : overParent.id === typeAnchorIds.expense
              ? 'expense'
              : 'both'
        });
        
        // Update order
        const oldParentId = activeCategory.parentId || '';
        const newParentId = overParent.id;
        
        // Remove from old parent order
        if (categoryOrder[oldParentId]) {
          setCategoryOrder(prev => ({
            ...prev,
            [oldParentId]: prev[oldParentId].filter(id => id !== active.id)
          }));
        }
        
        // Add to new parent order
        const targetIndex = categoryOrder[newParentId]?.indexOf(over.id as string) || 0;
        setCategoryOrder(prev => ({
          ...prev,
          [newParentId]: [
            ...(prev[newParentId] || []).slice(0, targetIndex + 1),
            active.id as string,
            ...(prev[newParentId] || []).slice(targetIndex + 1).filter(id => id !== active.id)
          ]
        }));
      } else if (activeParent && overParent && activeParent.id === overParent.id) {
        // Reordering within same parent
        const parentId = activeParent.id;
        const currentOrder = categoryOrder[parentId] || [];
        
        const oldIndex = currentOrder.indexOf(active.id as string);
        const newIndex = currentOrder.indexOf(over.id as string);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
          setCategoryOrder(prev => ({
            ...prev,
            [parentId]: newOrder
          }));
        }
      }
      return;
    }
  };

  const startEditing = (categoryId: string) => {
    // Transfer category names track their account ("To/From <account name>");
    // rename the account instead and the category follows automatically.
    const category = categories.find(c => c.id === categoryId);
    if (category?.isTransferCategory) {
      showError(new Error(
        'Transfer category names follow their account. Rename the account and this updates automatically.'
      ));
      return;
    }
    setEditingCategoryId(categoryId);
  };

  /**
   * The category open in the properties dialog. Read from `categories` rather
   * than held in state so the dialog always shows the row as it IS — a merge or
   * a refresh underneath it cannot leave a stale copy on screen.
   */
  const editingCategory = editingCategoryId
    ? categories.find(c => c.id === editingCategoryId) ?? null
    : null;

  /**
   * Everything that would be orphaned if this category disappeared: whole
   * transactions filed under it, split LINES inside other transactions, and
   * budgets pointing at it. Split parents are excluded from the transaction
   * figure because their own category is blank — their filing lives in the
   * lines, which are counted separately.
   */
  const referencesTo = (categoryId: string): { transactions: number; splitLines: number; budgets: number } => ({
    transactions: transactions.filter(t => t.category === categoryId && !t.isSplit).length,
    splitLines: transactionSplits.filter(s => s.category === categoryId).length,
    budgets: budgets.filter(b => b.categoryId === categoryId).length,
  });

  const handleDelete = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    // Account transfer categories are system-managed bookkeeping: created
    // with the account, renamed with it, hidden when it closes. Deleting one
    // would orphan that account's transfer history (the DB blocks it too).
    if (category.isTransferCategory) {
      showError(new Error(
        'Transfer categories are managed automatically from their account. Close the account to hide it instead.'
      ));
      return;
    }

    // EVERY reference routes through reassignment, not just transactions: a
    // budget left pointing at a deleted category keeps a dangling id and
    // silently reports £0 spent for ever after.
    const references = referencesTo(categoryId);
    const referenceCount = references.transactions + references.splitLines + references.budgets;
    const childCategories = categories.filter(c => c.parentId === categoryId);

    if (childCategories.length > 0) {
      alert('Cannot delete category with subcategories. Delete subcategories first.');
    } else if (referenceCount > 0) {
      setDeletingCategoryId(categoryId);
      setReassignCategoryId('');
    } else {
      if (confirm(`Are you sure you want to delete "${category.name}"?`)) {
        deleteCategory(categoryId);
      }
    }
  };

  const handleMerge = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    const blocked = mergeBlockedReason(category, categories);
    if (blocked) {
      showError(new Error(blocked));
      return;
    }
    setMergingCategoryId(categoryId);
    setMergeTargetId('');
  };

  /**
   * Run a merge and report what the DATABASE moved, not what was predicted.
   * Shared by the merge dialog and by "Delete & Reassign", which is the same
   * operation reached from the other end.
   */
  const runMerge = async (sourceId: string, targetId: string): Promise<void> => {
    const sourceName = categories.find(c => c.id === sourceId)?.name ?? 'that category';
    const targetName = categories.find(c => c.id === targetId)?.name ?? 'the new category';
    const result: CategoryMergeResult = await mergeCategories(sourceId, targetId);
    const moved = movingClause(result.transactions, result.splitLines, result.budgets);
    showSuccess(
      moved
        ? `${moved} moved from "${sourceName}" to "${targetName}".`
        : `"${sourceName}" was empty, so it has simply been removed.`,
      'Categories merged'
    );
  };

  const handleCategoryClick = (categoryId: string, categoryName: string) => {
    if (!isEditMode && !isDeleteMode) {
      setViewingCategoryId(categoryId);
      setViewingCategoryName(categoryName);
    }
  };

  /**
   * Data-health remedy 1: open the import bucket's rows so they can be filed.
   *
   * Straight to the list, past the "Would you like to see all transactions?"
   * confirmation a click on the tree gets — the user has just clicked an action
   * that says what it does, and asking them to confirm their own sentence twice
   * is friction, not safety.
   */
  const fileUnassignedBucket = (categoryId: string): void => {
    setViewingCategoryId(categoryId);
    setViewingCategoryName(categories.find(c => c.id === categoryId)?.name ?? 'Unassigned');
    setShowTransactionsModal(true);
  };

  /**
   * Data-health remedy 2: put the empty categories on screen with deletion
   * reachable.
   *
   * Three things have to be true before "delete this category" is one click
   * away, and the panel's action does all three rather than describing them:
   * the row must be VISIBLE (its group expanded — detail rows live inside
   * collapsed subs), it must be FOUND (highlighted, and the first scrolled to,
   * in a tree hundreds of rows long), and the delete affordance must be LIVE
   * (this page keeps deletion behind Edit → Delete mode, so we arrive in it,
   * with the red panel above the tree already explaining what a click now
   * means). Nothing is deleted for the user: an empty category still asks
   * before it goes.
   */
  const showEmptyCategories = (): void => {
    const ids = categoryHealth.emptyCategoryIds;
    if (ids.length === 0) return;

    setIsEditMode(true);
    setIsDeleteMode(true);
    setIsMergeMode(false);
    setEditingCategoryId(null);

    // Every ancestor of every flagged row, so none of them is hiding inside a
    // collapsed group when the user looks.
    const byId = new Map(categories.map(c => [c.id, c]));
    setExpandedCategories(prev => {
      const next = new Set(prev);
      for (const id of ids) {
        // `!next.has` is the loop's floor as well as its filter: a parentId
        // cycle in bad data would otherwise spin here for ever.
        let parentId: string | null = byId.get(id)?.parentId ?? null;
        while (parentId !== null && parentId !== '' && !next.has(parentId)) {
          next.add(parentId);
          parentId = byId.get(parentId)?.parentId ?? null;
        }
      }
      return next;
    });

    // A fresh token every time, so asking twice scrolls back twice.
    setEmptyHighlight({
      ids: new Set(ids),
      firstId: ids[0],
      token: `${ids[0]}#${Date.now()}`,
    });
  };

  /** Which of the highlighted rows, if any, this row is. */
  const highlightPropsFor = (categoryId: string): {
    isHighlighted: boolean;
    highlightRef?: (node: HTMLElement | null) => void;
  } => {
    if (emptyHighlight === null || !emptyHighlight.ids.has(categoryId)) {
      return { isHighlighted: false };
    }
    return {
      isHighlighted: true,
      highlightRef: categoryId === emptyHighlight.firstId ? scrollHighlightIntoView : undefined,
    };
  };

  const renderCategorySection = (title: string, parentId: string) => {
    // Inactive categories (a closed account's transfer category) stay out of
    // sight — reopening the account brings them back automatically.
    const subCategories = getSubCategories(parentId).filter(c => c.isActive !== false);
    
    // Sort subcategories by order
    const orderedSubCategories = [...subCategories].sort((a, b) => {
      const order = categoryOrder[parentId] || [];
      const aIndex = order.indexOf(a.id);
      const bIndex = order.indexOf(b.id);
      
      // If both are in the order, sort by order
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      // If only one is in the order, it comes first
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      // Otherwise maintain original order
      return 0;
    });
    
    const allDetailIds = orderedSubCategories.flatMap(sub => 
      getDetailCategories(sub.id).filter(d => d.isActive !== false).map(d => d.id)
    );
    
    return (
      <div>
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">{title}</h3>
        <SortableContext 
          items={[...orderedSubCategories.map(c => c.id), ...allDetailIds]}
          strategy={verticalListSortingStrategy}
        >
            <div className="space-y-1">
              {orderedSubCategories.map(subCategory => {
                const isExpanded = expandedCategories.has(subCategory.id);
                const detailCategories = getDetailCategories(subCategory.id).filter(d => d.isActive !== false);
                
                // Sort detail categories by order
                const orderedDetailCategories = [...detailCategories].sort((a, b) => {
                  const order = categoryOrder[subCategory.id] || [];
                  const aIndex = order.indexOf(a.id);
                  const bIndex = order.indexOf(b.id);
                  
                  if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                  if (aIndex !== -1) return -1;
                  if (bIndex !== -1) return 1;
                  return 0;
                });
                // Direct hits on the sub-category plus everything filed under
                // ANY of its detail children (including inactive ones, so the
                // rolled-up number always accounts for every transaction).
                const subTransactionCount =
                  (categoryTransactionCounts.get(subCategory.id) ?? 0) +
                  categories
                    .filter(c => c.parentId === subCategory.id)
                    .reduce((sum, c) => sum + (categoryTransactionCounts.get(c.id) ?? 0), 0);

                return (
                  <div key={subCategory.id}>
                    <SortableCategory
                      category={subCategory as Category}
                      isEditMode={isEditMode}
                      isDeleteMode={isDeleteMode}
                      isMergeMode={isMergeMode}
                      mergeBlockedReason={isMergeMode ? mergeBlockedReason(subCategory, categories) : null}
                      {...highlightPropsFor(subCategory.id)}
                      onEdit={() => startEditing(subCategory.id)}
                      onDelete={() => handleDelete(subCategory.id)}
                      onMerge={() => handleMerge(subCategory.id)}
                      onClick={() => handleCategoryClick(subCategory.id, subCategory.name)}
                      isDraggable={true}
                    >
                      <div className="flex items-center gap-2">
                        {orderedDetailCategories.length > 0 && (
                          <IconButton
                            onClick={(e) => {
                              e?.stopPropagation();
                              toggleCategoryExpanded(subCategory.id);
                            }}
                            icon={isExpanded ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
                            variant="ghost"
                            size="sm"
                            className="text-gray-500 hover:text-gray-700"
                            aria-label={isExpanded ? `Collapse ${subCategory.name}` : `Expand ${subCategory.name}`}
                          />
                        )}
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({subTransactionCount})
                        </span>
                      </div>
                    </SortableCategory>

                    {/* Detail categories */}
                    {isExpanded && orderedDetailCategories.length > 0 && (
                      <div className="ml-8 space-y-1">
                        {orderedDetailCategories.map(detailCategory => {
                              const detailTransactionCount = categoryTransactionCounts.get(detailCategory.id) ?? 0;

                              return (
                                <SortableCategory
                                  key={detailCategory.id}
                                  category={detailCategory as Category}
                                  isEditMode={isEditMode}
                                  isDeleteMode={isDeleteMode}
                                  isMergeMode={isMergeMode}
                                  mergeBlockedReason={isMergeMode ? mergeBlockedReason(detailCategory, categories) : null}
                                  {...highlightPropsFor(detailCategory.id)}
                                  onEdit={() => startEditing(detailCategory.id)}
                                  onDelete={() => handleDelete(detailCategory.id)}
                                  onMerge={() => handleMerge(detailCategory.id)}
                                  onClick={() => handleCategoryClick(detailCategory.id, detailCategory.name)}
                                  isDraggable={true}
                                >
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    ({detailTransactionCount})
                                  </span>
                                </SortableCategory>
                              );
                        })}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </SortableContext>
      </div>
    );
  };

  return (
    <PageWrapper 
      title="Categories"
      rightContent={
        <div className="flex gap-2">
          <button
            onClick={() => {
              setIsEditMode(!isEditMode);
              if (isDeleteMode) setIsDeleteMode(false);
              if (isMergeMode) setIsMergeMode(false);
              setEditingCategoryId(null);
              // Leaving edit mode is the user saying they are done with the
              // rows the health panel pointed at, so the highlight goes with it.
              if (isEditMode) setEmptyHighlight(null);
            }}
            className={`w-8 h-8 flex items-center justify-center transition-colors ${
              isEditMode
                ? 'text-white bg-gray-600 hover:bg-gray-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title={isEditMode ? 'Done Editing' : 'Edit Categories'}
          >
            <Settings2Icon size={16} />
          </button>
          {/* Merge sits beside Delete, inside Edit mode, because it is the same
              kind of structural change reached the same way: a mode, then the
              category you mean. One click of a row, not a button per row —
              which would put a control on every line of a long tree. */}
          {isEditMode && (
            <IconButton
              onClick={() => {
                setIsMergeMode(!isMergeMode);
                if (!isMergeMode) setIsDeleteMode(false);
                setEditingCategoryId(null);
              }}
              icon={<MergeIcon size={16} />}
              variant={isMergeMode ? 'primary' : 'ghost'}
              size="sm"
              className={isMergeMode ? '' : 'text-gray-500 hover:text-gray-700'}
              title={isMergeMode ? 'Cancel Merge' : 'Merge Categories'}
            />
          )}
          {isEditMode && (
            <IconButton
              onClick={() => {
                setIsDeleteMode(!isDeleteMode);
                if (!isDeleteMode) setIsMergeMode(false);
              }}
              icon={<DeleteIcon size={16} />}
              variant={isDeleteMode ? 'danger' : 'ghost'}
              size="sm"
              className={isDeleteMode ? '' : 'text-gray-500 hover:text-gray-700'}
              title={isDeleteMode ? 'Cancel Delete' : 'Delete Categories'}
            />
          )}
          <IconButton
            onClick={() => setShowCategoryModal(true)}
            icon={<PlusIcon size={16} />}
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-700"
            title="Add Category"
          />
        </div>
      }
    >

      {/* Desktop: the page chrome (title/toolbar above, instructions + import
          below) stays in view and the category tree scrolls internally, so
          the edit/delete/add buttons are always reachable. Mobile keeps the
          normal page scroll. */}
      <div className="lg:flex lg:flex-col lg:h-[calc(100vh-13rem)]">

      {/* Instructions */}
      {(isEditMode || isDeleteMode) ? (
        <div className={`lg:shrink-0 border rounded-2xl p-4 mb-6 ${
          isDeleteMode
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        }`}>
          <div className={`text-sm space-y-2 ${
            isDeleteMode ? 'text-red-800 dark:text-red-200' : 'text-blue-800 dark:text-blue-200'
          }`}>
            <p><strong>{isDeleteMode ? 'Delete Mode Active:' : isMergeMode ? 'Merge Mode Active:' : 'Edit Mode Active:'}</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              {isDeleteMode ? (
                <>
                  <li>Click on any category to delete it</li>
                  <li>Categories still in use will prompt for reassignment</li>
                  <li>Categories with subcategories must have subcategories deleted first</li>
                </>
              ) : isMergeMode ? (
                <>
                  <li>Click the category you want to merge away, then choose the one it joins</li>
                  <li>Everything filed under it moves across — transactions, split lines and budgets</li>
                  <li>Groups and the app&apos;s own categories are greyed out and say why</li>
                </>
              ) : (
                <>
                  <li>Click on any category name to rename it, or to say it holds adjustments rather than income or spending</li>
                  <li>Drag detail categories to different subcategories to reorganize them</li>
                  <li>Toggle Merge Mode to join two categories, or Delete Mode to remove one</li>
                  <li>Default categories can be edited just like custom ones</li>
                </>
              )}
            </ul>
          </div>
        </div>
      ) : (
        <div className="lg:shrink-0 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 mb-6">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="mb-2">💡 <strong>Tip:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Click on any category name to view its transactions</li>
              <li>Click the arrow buttons to expand/collapse subcategories</li>
              <li>Use Edit Mode to rename or reorganize categories</li>
              <li>The number in parentheses shows how many transactions are in each category</li>
            </ul>
          </div>
        </div>
      )}

      {/* Starter set import */}
      {!isEditMode && !isDeleteMode && (
        <div className="lg:shrink-0 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Standard category set
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Switch to the standard starter category tree. Unused default categories
              are removed; anything your transactions use is kept.
            </p>
          </div>
          <button
            onClick={() => void handleImportDefaultSet()}
            disabled={isImporting}
            className="px-4 py-2 text-sm font-medium bg-[#1a2332] text-white rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap self-start sm:self-auto"
          >
            {isImporting ? 'Importing…' : 'Import starter set'}
          </button>
        </div>
      )}

      {/* Data health — where the category data is weak (renders nothing when
          clean). Every line it shows carries an action, and both of the actions
          that land on THIS page are wired here. */}
      <CategoryDataHealthPanel
        health={categoryHealth}
        onFileUnassignedBucket={fileUnassignedBucket}
        onShowEmptyCategories={showEmptyCategories}
      />

      {/* Categories Tree — the scrolling region on desktop */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-6">
            {renderCategorySection('Income Categories', typeAnchorIds.income)}
            {renderCategorySection('Expense Categories', typeAnchorIds.expense)}
            {renderCategorySection('Transfer Categories', typeAnchorIds.transfer)}
          
          {/* Other Categories */}
          <div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Other Categories</h3>
            <div className="space-y-1">
              {categories.filter(cat => cat.type === 'both' && cat.level === 'detail' && !cat.parentId && cat.isActive !== false).map(category => {
                const transactionCount = categoryTransactionCounts.get(category.id) ?? 0;

                return (
                  <div key={category.id} className="ml-4">
                    <SortableCategory
                      category={category as Category}
                      isEditMode={isEditMode}
                      isDeleteMode={isDeleteMode}
                      isMergeMode={isMergeMode}
                      mergeBlockedReason={isMergeMode ? mergeBlockedReason(category, categories) : null}
                      {...highlightPropsFor(category.id)}
                      onEdit={() => startEditing(category.id)}
                      onDelete={() => handleDelete(category.id)}
                      onMerge={() => handleMerge(category.id)}
                      onClick={() => handleCategoryClick(category.id, category.name)}
                      isDraggable={false}
                    >
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({transactionCount})
                      </span>
                    </SortableCategory>
                  </div>
                );
              })}
            </div>
          </div>
          </div>
          <DragOverlay>
            {activeId ? (
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl p-2 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 opacity-90">
                {categories.find(c => c.id === activeId)?.name}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      </div>{/* end desktop flex column */}

      {/* Category Delete Confirmation Dialog */}
      {deletingCategoryId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-category-heading"
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full"
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertCircleIcon className="text-orange-500" size={24} />
              <h3 id="delete-category-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
                Delete Category
              </h3>
            </div>
            {(() => {
              const category = categories.find(c => c.id === deletingCategoryId);
              const references = referencesTo(deletingCategoryId);
              const held = movingClause(references.transactions, references.splitLines, references.budgets);
              const only = references.transactions + references.splitLines + references.budgets === 1;
              const targetName = categories.find(c => c.id === reassignCategoryId)?.name;

              return (
                <>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {held} {only ? 'is' : 'are'} filed under &ldquo;{category?.name}&rdquo;,
                    so {only ? 'it needs' : 'they need'} somewhere to go before it can be removed.
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Please select a category to reassign them to:
                  </p>
                  {/* Same searchable grouped picker as the transaction editor —
                      it filters out inactive categories (a closed account's
                      transfer categories, stale renames) automatically. */}
                  <div className="mb-6">
                    <CategorySelector
                      selectedCategory={reassignCategoryId}
                      onCategoryChange={setReassignCategoryId}
                      transactionType={category?.type === 'income' ? 'income' : 'expense'}
                      includeAllTypes={category?.type === 'both'}
                      excludeIds={[deletingCategoryId]}
                      placeholder="Search or select category…"
                      allowCreate={false}
                      showHelperText={false}
                      usePortal
                    />
                  </div>
                  {/* Consequence before the button, in the same words the merge
                      dialog uses — because this IS a merge, reached from the
                      "I want this gone" end. */}
                  {reassignCategoryId && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                      {held} move to &ldquo;{targetName}&rdquo;; &ldquo;{category?.name}&rdquo; is then removed.
                      Payee memory and future imports follow &ldquo;{targetName}&rdquo;.
                    </p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setDeletingCategoryId(null);
                        setReassignCategoryId('');
                      }}
                      disabled={isReassigning}
                      className="flex-1 justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!reassignCategoryId || reassignCategoryId === deletingCategoryId || isReassigning) {
                          return;
                        }
                        setIsReassigning(true);
                        try {
                          // ONE atomic call. This used to be a round trip per
                          // transaction, then a split rewrite per parent, then
                          // the delete — with budgets left behind entirely and
                          // nothing to undo a half-finished run.
                          await runMerge(deletingCategoryId, reassignCategoryId);
                          setDeletingCategoryId(null);
                          setReassignCategoryId('');
                        } catch (error) {
                          showError(error);
                        } finally {
                          setIsReassigning(false);
                        }
                      }}
                      className="flex-1 justify-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                      disabled={!reassignCategoryId || isReassigning}
                    >
                      {isReassigning ? 'Reassigning…' : 'Delete & Reassign'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Category Merge Dialog */}
      {mergingCategoryId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="merge-category-heading"
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full"
          >
            <div className="flex items-center gap-3 mb-4">
              <MergeIcon className="text-primary" size={24} />
              <h3 id="merge-category-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
                Merge Category
              </h3>
            </div>
            {(() => {
              const source = categories.find(c => c.id === mergingCategoryId);
              const target = categories.find(c => c.id === mergeTargetId);
              const references = referencesTo(mergingCategoryId);
              const moving = movingClause(references.transactions, references.splitLines, references.budgets);
              // A budget already on the target means the user ends up with two
              // on one category. Said out loud, once, only when it applies.
              const targetBudgets = mergeTargetId
                ? budgets.filter(b => b.categoryId === mergeTargetId).length
                : 0;

              return (
                <>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Everything filed under &ldquo;{source?.name}&rdquo; moves to the category you choose,
                    and &ldquo;{source?.name}&rdquo; is then removed.
                  </p>
                  <div className="mb-6">
                    <CategorySelector
                      selectedCategory={mergeTargetId}
                      onCategoryChange={setMergeTargetId}
                      transactionType={source?.type === 'income' ? 'income' : 'expense'}
                      includeAllTypes={source?.type === 'both'}
                      excludeIds={[mergingCategoryId]}
                      placeholder="Merge into…"
                      allowCreate={false}
                      showHelperText={false}
                      usePortal
                    />
                  </div>
                  {mergeTargetId && (
                    <div className="mb-6 rounded-xl border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3">
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        {moving
                          ? <>{moving} move to &ldquo;{target?.name}&rdquo;; &ldquo;{source?.name}&rdquo; is then removed.</>
                          : <>Nothing is filed under &ldquo;{source?.name}&rdquo;, so it is simply removed.</>}
                        {' '}Payee memory and future imports follow &ldquo;{target?.name}&rdquo;.
                        {references.budgets > 0 && targetBudgets > 0 && (
                          <> &ldquo;{target?.name}&rdquo; will then have {(targetBudgets + references.budgets).toLocaleString()} budgets — tidy them on the Budgets page.</>
                        )}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setMergingCategoryId(null);
                        setMergeTargetId('');
                      }}
                      disabled={isMerging}
                      className="flex-1 justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!mergeTargetId || mergeTargetId === mergingCategoryId || isMerging) {
                          return;
                        }
                        setIsMerging(true);
                        try {
                          await runMerge(mergingCategoryId, mergeTargetId);
                          setMergingCategoryId(null);
                          setMergeTargetId('');
                        } catch (error) {
                          showError(error);
                        } finally {
                          setIsMerging(false);
                        }
                      }}
                      className="flex-1 justify-center px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary disabled:opacity-50"
                      disabled={!mergeTargetId || isMerging}
                    >
                      {isMerging ? 'Merging…' : 'Merge'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Category properties — name, and whether it reports as an adjustment */}
      {editingCategory && (
        <EditCategoryModal
          isOpen={true}
          onClose={() => setEditingCategoryId(null)}
          category={editingCategory}
          // The DIRECT count, not the group's rolled-up figure: the flag applies
          // to this category alone, so this is what actually moves.
          directTransactionCount={categoryTransactionCounts.get(editingCategory.id) ?? 0}
          hasChildren={categories.some(c => c.parentId === editingCategory.id)}
          onSave={async ({ name, isRevaluationCategory }) => {
            await updateCategory(editingCategory.id, { name, isRevaluationCategory });
          }}
        />
      )}

      {/* Category Creation Modal */}
      <CategoryCreationModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
      />

      {/* View Transactions Confirmation */}
      {viewingCategoryId && !showTransactionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              View Transactions
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Would you like to see all transactions in the "{viewingCategoryName}" category?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setViewingCategoryId(null);
                  setViewingCategoryName('');
                }}
                className="flex-1 justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowTransactionsModal(true);
                }}
                className="flex-1 justify-center px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary"
              >
                View Transactions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Transactions Modal */}
      {showTransactionsModal && viewingCategoryId && (
        <CategoryTransactionsModal
          isOpen={true}
          onClose={() => {
            setShowTransactionsModal(false);
            setViewingCategoryId(null);
            setViewingCategoryName('');
          }}
          categoryId={viewingCategoryId}
          categoryName={viewingCategoryName}
        />
      )}
    </PageWrapper>
  );
}