import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { useTransactionNotifications } from '../hooks/useTransactionNotifications';
import { usePayeeMemory } from '../hooks/usePayeeMemory';
import { CalendarIcon, TagIcon, FileTextIcon, CheckIcon2, LinkIcon, PlusIcon, HashIcon, WalletIcon, ArrowRightLeftIcon, BanknoteIcon, PaperclipIcon, XIcon } from '../components/icons';
import type { Transaction } from '../types';
import {
  splitRemainder,
  validateSplitDrafts,
  signSplitAmounts,
  displaySplitAmount,
  type SplitLineDraft,
} from '../utils/transactionSplits';
import CategoryCreationModal from './CategoryCreationModal';
import TransferMatchDialog from './TransferMatchDialog';
import { findTransferCandidates, transferCategoryFor, type TransferCandidate } from '../utils/transferMatch';
import { useToast } from '../contexts/ToastContext';
import CategorySelector from './CategorySelector';
import TagSelector from './TagSelector';
import { getCurrencySymbol } from '../utils/currency';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useModalForm } from '../hooks/useModalForm';
import MarkdownEditor from './MarkdownEditor';
import DocumentManager from './DocumentManager';
import { ValidationService } from '../services/validationService';
import { z } from 'zod';
import { toDecimal, Decimal, parseMoneyInput } from '../utils/decimal';
import { signTransactionAmount } from '../utils/transactionAmount';
import { formatDecimal } from '../utils/decimal-format';
import { createScopedLogger } from '../loggers/scopedLogger';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  /** Account to pre-select for NEW transactions (e.g. the account being reconciled). */
  defaultAccountId?: string;
  /**
   * Batch mode: when provided (and editing an existing transaction), a
   * "Save & Next" button appears — it saves, keeps the modal open, and asks
   * the caller to swap in the next transaction from its list.
   */
  onSaveAndNext?: () => void;
  /**
   * Batch mode counterpart: when provided, a "Previous" button appears that
   * saves and swaps in the PREVIOUS transaction from the caller's list.
   */
  onSaveAndPrevious?: () => void;
}

interface FormData {
  date: string;
  description: string;
  amount: string;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  subCategory: string;
  accountId: string;
  tags: string[];
  notes: string;
  cleared: boolean;
  reconciledWith: string;
}

export default function EditTransactionModal({ isOpen, onClose, transaction, defaultAccountId, onSaveAndNext, onSaveAndPrevious }: EditTransactionModalProps): React.JSX.Element {
  const { accounts, categories, transactions, updateTransaction, deleteTransaction, getTransactionSplits, setTransactionSplits, linkTransferPair, createTransferCounterpart } = useApp();
  const { showSuccess, showError } = useToast();
  const { addTransaction } = useTransactionNotifications();
  const { propagateCategory } = usePayeeMemory();
  const logger = useMemo(() => createScopedLogger('EditTransactionModal'), []);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [formattedAmount, setFormattedAmount] = useState('');
  // Money-style cross-type categorization: browse the OTHER direction's
  // categories (e.g. file a refund — income by sign — under an expense
  // category so it nets that expense down).
  const [crossTypeCategories, setCrossTypeCategories] = useState(false);
  // Split mode (Money-style): categorisation moves into category+amount lines
  // that must sum exactly to the transaction amount. Amounts here live in the
  // ENTERED domain (positive magnitudes, minus = a reducing line like
  // cashback); signing to the DB convention happens once at save.
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitLines, setSplitLines] = useState<SplitLineDraft[]>([]);
  const [splitsLoading, setSplitsLoading] = useState(false);
  // Money-style transfer flow: converting an existing row into a transfer
  // (via a To/From category or the Transfer type) opens a match-or-create
  // confirmation instead of writing blindly.
  const [transferPrompt, setTransferPrompt] = useState<{
    targetAccountId: string;
    candidates: TransferCandidate[];
  } | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);
  // Batch mode coordination: Save & Next / Previous set a direction; a
  // successful submit consumes it and suppresses the close that useModalForm
  // fires afterwards.
  const advanceDirectionRef = useRef<'next' | 'previous' | null>(null);
  const suppressCloseRef = useRef(false);
  
  // Initialize form with transaction data if editing, otherwise use defaults
  const initialFormData: FormData = transaction ? {
    date: transaction.date instanceof Date ? transaction.date.toISOString().split('T')[0] : new Date(transaction.date).toISOString().split('T')[0],
    description: transaction.description,
    amount: transaction.type === 'transfer' ? transaction.amount.toString() : Math.abs(transaction.amount).toString(),
    type: transaction.type,
    category: '',  // Will be set in useEffect
    subCategory: '', // Will be set in useEffect
    accountId: transaction.accountId,
    tags: transaction.tags || [],
    notes: transaction.notes || '',
    cleared: transaction.cleared || false,
    reconciledWith: transaction.reconciledWith || ''
  } : {
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'expense',
    category: '',
    subCategory: '',
    accountId: defaultAccountId ?? (accounts.length > 0 ? accounts[0].id : ''),
    tags: [],
    notes: '',
    cleared: false,
    reconciledWith: ''
  };
  
  const { formData, updateField, handleSubmit, setFormData, errors, isSubmitting } = useModalForm<FormData>(
    initialFormData,
    {
      onSubmit: async (data) => {
        // Consume the advance intent up front so a failed save never leaves a
        // stale "advance" that would hijack the NEXT ordinary Save.
        const advanceDirection = advanceDirectionRef.current;
        advanceDirectionRef.current = null;
        try {
          const isTransfer = data.type === 'transfer';
          // A freshly-chosen outgoing transfer encodes its target in the
          // category ('transfer:<id>'); an existing transfer being edited keeps
          // the target/category it already has.
          const isNewTransferSelection = data.category.startsWith('transfer:');
          const editingExistingTransfer = isTransfer && !!transaction;

          // CRITICAL: a NEW transfer must have a target account selected. An
          // EXISTING transfer already has one, so editing it must not demand a
          // re-selection (which previously made every transfer edit throw).
          if (isTransfer && !isNewTransferSelection && !editingExistingTransfer) {
            throw new Error('Please select an account to transfer to.');
          }

          const targetAccountId = isNewTransferSelection
            ? data.category.slice('transfer:'.length)
            : transaction?.transferAccountId;   // preserve on edit

          // A linked pair's target is structural — moving it would strand the
          // opposite row. v1: recreate the transfer to move it.
          if (transaction?.linkedTransferId && isNewTransferSelection &&
              targetAccountId !== transaction.transferAccountId) {
            throw new Error(
              'This transfer is linked to its opposite transaction. To move it, delete the transfer and recreate it.'
            );
          }

          const resolvedType = isTransfer || isNewTransferSelection ? 'transfer' : data.type;
          // Transfers file under the target account's To/From category. An
          // unchanged edit keeps whatever the row already carries; a new
          // selection resolves the target's category (legacy sentinel only if
          // the account somehow has none).
          const resolvedCategory = isNewTransferSelection
            ? (transaction && targetAccountId === transaction.transferAccountId && transaction.category
                ? transaction.category
                : (transferCategoryFor(categories, targetAccountId ?? '')?.id ?? 'transfer-out'))
            : data.category;

          // Filing under a To/From category = "make this a transfer".
          const chosenCategoryObj = categories.find(c => c.id === data.category);
          if (!transaction && chosenCategoryObj?.isTransferCategory) {
            throw new Error('To record a new transfer, use the Transfer type above — it creates both sides.');
          }

          const validatedData = ValidationService.validateTransaction({
            id: transaction?.id,
            description: data.description,
            amount: data.amount,
            type: resolvedType === 'transfer' ? 'expense' : resolvedType,
            category: resolvedCategory,
            accountId: data.accountId,
            date: data.date,
            tags: data.tags.length > 0 ? data.tags : undefined,
            notes: data.notes.trim() || undefined,
          });

          // Split saves only exist for EDITS of income/expense rows; the rule
          // is enforced before any write so a lopsided split never half-saves.
          const splitting = isSplitMode && !!transaction && resolvedType !== 'transfer';
          if (splitting) {
            const splitError = validateSplitDrafts(data.amount, splitLines);
            if (splitError) {
              throw new Error(splitError);
            }
          }

          // Converting an EXISTING row into a transfer (To/From category
          // chosen, or Type switched to Transfer with a target): save the
          // ordinary field edits, then hand over to the Money-style
          // match-or-create flow, which owns the category/type change. The
          // row's stored amount stays authoritative for matching.
          const conversionTargetId = !splitting && transaction && !transaction.linkedTransferId
            ? (isNewTransferSelection && transaction.type !== 'transfer'
                ? targetAccountId
                : (resolvedType !== 'transfer' && chosenCategoryObj?.isTransferCategory
                    ? chosenCategoryObj.accountId
                    : undefined))
            : undefined;
          if (conversionTargetId && transaction) {
            if (conversionTargetId === validatedData.accountId) {
              throw new Error(
                "That's this account's own transfer category — pick the OTHER account's To/From category."
              );
            }
            if (transaction.isSplit) {
              throw new Error('A split transaction cannot become a transfer — remove the split first.');
            }
            await updateTransaction(transaction.id, {
              date: new Date(validatedData.date),
              description: validatedData.description,
              accountId: validatedData.accountId,
              tags: validatedData.tags,
              notes: validatedData.notes,
              cleared: data.cleared,
              reconciledWith: data.reconciledWith.trim() || undefined
            });
            suppressCloseRef.current = true; // the dialog decides when to close
            setTransferPrompt({
              targetAccountId: conversionTargetId,
              candidates: findTransferCandidates(
                transactions,
                {
                  ...transaction,
                  accountId: validatedData.accountId,
                  date: new Date(validatedData.date),
                  description: validatedData.description,
                },
                conversionTargetId
              ),
            });
            return;
          }

          const parsedAmount = parseMoneyInput(validatedData.amount) ?? 0;
          // Sign the stored amount. Income/expense are seeded as Math.abs, so
          // re-sign by type. Transfers ENCODE DIRECTION in their sign: an edit
          // keeps the entered/seeded sign (so an incoming +transfer can't be
          // flipped to outgoing), while a newly-selected outgoing transfer is
          // negative.
          const signedAmount = resolvedType === 'transfer'
            ? (transaction ? parsedAmount : -Math.abs(parsedAmount))
            : signTransactionAmount(parsedAmount, resolvedType as 'income' | 'expense');
          const transactionData = {
            date: new Date(validatedData.date),
            description: validatedData.description,
            amount: signedAmount,
            type: resolvedType,
            category: resolvedCategory,
            accountId: validatedData.accountId,
            transferAccountId: targetAccountId,
            tags: validatedData.tags,
            notes: validatedData.notes,
            cleared: data.cleared,
            reconciledWith: data.reconciledWith.trim() || undefined
          };

          // Await the writes so a failed RPC surfaces via the form's submit
          // error instead of silently closing the modal (fire-and-forget bug).
          if (transaction) {
            if (splitting) {
              // A split parent's amount/category/type are guarded by a DB
              // trigger — only set_transaction_splits may change them. The
              // ordinary update carries everything else; the RPC then swaps
              // the split lines in, re-validates the sum against the entered
              // amount server-side, and syncs amount + account balance.
              await updateTransaction(transaction.id, {
                date: transactionData.date,
                description: transactionData.description,
                accountId: transactionData.accountId,
                tags: transactionData.tags,
                notes: transactionData.notes,
                cleared: transactionData.cleared,
                reconciledWith: transactionData.reconciledWith
              });
              await setTransactionSplits(
                transaction.id,
                signSplitAmounts(splitLines, resolvedType as 'income' | 'expense'),
                signedAmount
              );
            } else if (transaction.isSplit) {
              // Un-split FIRST — while is_split the guard trigger rejects the
              // category/amount this update carries.
              await setTransactionSplits(transaction.id, [], null);
              await updateTransaction(transaction.id, transactionData);
            } else {
              await updateTransaction(transaction.id, transactionData);
            }
          } else {
            await addTransaction(transactionData);
          }

          // Create paired transaction in target account for NEW transfers only
          if (isNewTransferSelection && targetAccountId && !transaction) {
            await addTransaction({
              date: new Date(validatedData.date),
              description: validatedData.description,
              amount: Math.abs(parsedAmount),
              type: 'transfer',
              category: 'transfer-in',
              accountId: targetAccountId,
              transferAccountId: validatedData.accountId,
              tags: validatedData.tags,
              notes: validatedData.notes,
              cleared: false
            });
          }

          // Payee memory (the Microsoft Money model): the category just chosen
          // spreads to every UNCATEGORIZED same-direction transaction with the
          // same payee in this account. Cross-type filings (a one-off refund
          // correction) deliberately do NOT teach payee memory — a mixed-flow
          // payee like PayPal must not get all its incoming money stamped with
          // an expense category.
          if (!splitting && resolvedType !== 'transfer' && resolvedCategory && !crossTypeCategories &&
              resolvedCategory !== transaction?.category) {
            await propagateCategory({
              accountId: validatedData.accountId,
              description: validatedData.description,
              type: resolvedType,
              categoryId: resolvedCategory,
              excludeId: transaction?.id,
            });
          }

          // Batch mode: "Save & Next" keeps the modal open — the caller swaps
          // in the next transaction and the form repopulates from the prop.
          // useModalForm calls our onClose after this resolves; suppress it.
          if (advanceDirection === 'next' && onSaveAndNext) {
            suppressCloseRef.current = true;
            onSaveAndNext();
          } else if (advanceDirection === 'previous' && onSaveAndPrevious) {
            suppressCloseRef.current = true;
            onSaveAndPrevious();
          }
        } catch (error) {
          if (error instanceof z.ZodError) {
            logger.error('Validation failed', error);
          } else {
            logger.error('Failed to save transaction', error as Error);
          }
          throw error; // Re-throw so useModalForm displays the error
        }
      },
      onClose: () => {
        if (suppressCloseRef.current) {
          suppressCloseRef.current = false;
          return;
        }
        onClose();
      }
    }
  );

  // Build unified flat category list grouped by parent sub-category
  const groupedCategories = useMemo(() => {
    // Inactive categories (a closed account's transfer category) never appear
    // in transaction dropdowns; reopening the account restores them.
    const detailCats = categories.filter(c =>
      c.level === 'detail' && c.id !== 'transfer-in' && c.id !== 'transfer-out' && c.isActive !== false
    );
    const subCats = categories.filter(c => c.level === 'sub' && c.isActive !== false);

    // Group detail categories by their parent sub-category
    const groups: { label: string; type: 'income' | 'expense' | 'both'; items: { id: string; name: string; parentName: string }[] }[] = [];
    for (const sub of subCats) {
      const children = detailCats.filter(d => d.parentId === sub.id);
      if (children.length > 0) {
        groups.push({
          label: sub.name,
          type: sub.type as 'income' | 'expense' | 'both',
          items: children.map(c => ({ id: c.id, name: c.name, parentName: sub.name }))
        });
      }
    }

    // 'both'-typed groups (e.g. Adjustments) are valid for either direction —
    // include them on both sides so an income row carrying such a category is
    // always representable in the select.
    const incomeGroups = groups.filter(g => g.type === 'income' || g.type === 'both');
    const expenseGroups = groups.filter(g => g.type === 'expense' || g.type === 'both');

    // Transfer accounts: all accounts except the current transaction's account
    const transferAccounts = accounts
      .filter(a => a.isActive !== false && a.id !== formData.accountId)
      .map(a => ({ id: `transfer:${a.id}`, name: a.name }));

    return { incomeGroups, expenseGroups, transferAccounts };
  }, [categories, accounts, formData.accountId]);

  // Helper function to format number with commas
  const formatWithCommas = (value: string | number): string => {
    if (value === '') {
      return '';
    }

    const decimalValue = typeof value === 'string' ? toDecimal(value || 0) : toDecimal(value);
    if (!decimalValue.isFinite()) {
      return '';
    }

    const rounded = decimalValue.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const formatted = formatDecimal(rounded.abs(), 2, { group: true });

    return `${rounded.isNegative() ? '-' : ''}${formatted}`;
  };

  // Helper function to parse formatted string back to number
  const parseFormattedAmount = (value: string): string => {
    return value.replace(/,/g, '');
  };

  // Initialize form when transaction changes
  useEffect(() => {
    if (transaction) {
      // Existing transfers seed the target select ('transfer:<account>') so
      // it DISPLAYS the current target instead of the placeholder; the save
      // path preserves the row's category when the target is unchanged.
      const categoryId = transaction.type === 'transfer' && transaction.transferAccountId
        ? `transfer:${transaction.transferAccountId}`
        : (transaction.category || '');
      
      // For transfers, preserve the sign to show transfer direction
      // For income/expense, always use absolute value since type determines sign
      const amountValue = transaction.type === 'transfer' 
        ? transaction.amount.toString()
        : Math.abs(transaction.amount).toString();
        
      setFormData({
        date: transaction.date instanceof Date ? transaction.date.toISOString().split('T')[0] : new Date(transaction.date).toISOString().split('T')[0],
        description: transaction.description,
        amount: amountValue,
        type: transaction.type,
        category: categoryId,
        subCategory: '',
        accountId: transaction.accountId,
        tags: transaction.tags || [],
        notes: transaction.notes || '',
        cleared: transaction.cleared || false,
        reconciledWith: transaction.reconciledWith || ''
      });
      // Set formatted amount for display
      setFormattedAmount(formatWithCommas(amountValue));
      // Cross-type detection: a category from the OTHER direction's tree
      // (e.g. a refund filed under an expense category) opens with the
      // toggle already on so the select can represent the stored value.
      const currentCategory = categories.find(c => c.id === categoryId);
      setCrossTypeCategories(
        (transaction.type === 'income' || transaction.type === 'expense') &&
        currentCategory !== undefined &&
        (currentCategory.type === 'income' || currentCategory.type === 'expense') &&
        currentCategory.type !== transaction.type
      );
    } else {
      // Reset form for new transaction
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        date: today,
        description: '',
        amount: '',
        type: 'expense',
        subCategory: '',
        category: '',
        accountId: defaultAccountId ?? (accounts.length > 0 ? accounts[0].id : ''),
        tags: [],
        notes: '',
        cleared: false,
        reconciledWith: ''
      });
      setFormattedAmount('');
      setCrossTypeCategories(false);
    }
    setShowDeleteConfirm(false);
  }, [transaction, accounts, categories, setFormData, defaultAccountId]);

  // Load an already-split transaction's lines into the editor (stored signed
  // amounts convert back to the entered domain). Non-split rows reset the
  // split state so batch mode (Save & Next) never leaks lines between rows.
  useEffect(() => {
    let cancelled = false;
    if (transaction?.isSplit) {
      setIsSplitMode(true);
      setSplitsLoading(true);
      getTransactionSplits(transaction.id)
        .then(splits => {
          if (cancelled) return;
          const direction = transaction.type === 'income' ? 'income' : 'expense';
          setSplitLines(splits.map(s => ({
            category: s.category,
            amount: displaySplitAmount(s.amount, direction),
            ...(s.memo ? { memo: s.memo } : {}),
          })));
        })
        .catch(error => {
          if (!cancelled) {
            logger.error('Failed to load transaction splits', error as Error);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSplitsLoading(false);
          }
        });
    } else {
      setIsSplitMode(false);
      setSplitLines([]);
      setSplitsLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [transaction, getTransactionSplits, logger]);

  const handleSplitToggle = (checked: boolean): void => {
    setIsSplitMode(checked);
    if (checked && splitLines.length === 0) {
      // Seed with the current single category carrying the full amount, plus
      // one empty line to move part of it into.
      setSplitLines([
        { category: formData.category, amount: formData.amount },
        { category: '', amount: '' },
      ]);
    }
  };

  const updateSplitLine = (index: number, patch: Partial<SplitLineDraft>): void => {
    setSplitLines(prev => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const addSplitLine = (): void => {
    setSplitLines(prev => [...prev, { category: '', amount: '' }]);
  };

  const removeSplitLine = (index: number): void => {
    setSplitLines(prev => prev.filter((_, i) => i !== index));
  };

  // Save is blocked while the split doesn't balance; the remainder line
  // doubles as the explanation.
  const splitActive = isSplitMode && !!transaction && formData.type !== 'transfer';
  const splitValidationMessage = splitActive ? validateSplitDrafts(formData.amount, splitLines) : null;
  const splitRemaining = splitActive ? splitRemainder(formData.amount, splitLines) : null;

  // Complete the transfer flow (link or create) and close the editor. A
  // failure keeps the dialog open so the user can retry or cancel.
  const completeTransfer = async (action: () => Promise<unknown>, successMessage: string): Promise<void> => {
    setTransferBusy(true);
    try {
      await action();
      showSuccess(successMessage);
      setTransferPrompt(null);
      onClose();
    } catch (error) {
      logger.error('Transfer conversion failed', error as Error);
      showError(error);
    } finally {
      setTransferBusy(false);
    }
  };

  const handleDelete = () => {
    if (!transaction) return;
    deleteTransaction(transaction.id);
    onClose();
  };


  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={transaction ? 'Edit Transaction' : 'New Transaction'} size="xl">
        <form onSubmit={handleSubmit}>
          <ModalBody>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Date */}
            <div className="md:col-span-5">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <CalendarIcon size={16} />
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => updateField('date', e.target.value)}
                className="w-full px-3 py-3 sm:py-2 h-12 sm:h-[42px] text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white"
                required
              />
            </div>

            {/* Account */}
            <div className="md:col-span-7">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <WalletIcon size={16} />
                Account
              </label>
              <select
                value={formData.accountId}
                onChange={(e) => updateField('accountId', e.target.value)}
                className="w-full px-3 py-3 sm:py-2 h-12 sm:h-[42px] text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white"
                required
              >
                <option value="">Select account</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="md:col-span-12">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <FileTextIcon size={16} />
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="w-full px-3 py-3 sm:py-2 h-12 sm:h-[42px] text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white"
                required
              />
            </div>

            {/* Type */}
            <div className="md:col-span-12">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <ArrowRightLeftIcon size={16} />
                Type
              </label>
              <div className="flex gap-1 items-center h-[42px] bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {(['income', 'expense', 'transfer'] as const).map((t) => {
                  const isActive = formData.type === t;
                  // A split transaction's type is locked by the DB guard
                  // (its sign convention is baked into the split lines) and
                  // transfers cannot be split at all.
                  const lockedBySplit = isSplitMode && !isActive &&
                    (t === 'transfer' || transaction?.isSplit === true);
                  const colors = {
                    income: isActive ? 'bg-white dark:bg-gray-600 text-green-600 dark:text-green-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-green-600',
                    expense: isActive ? 'bg-white dark:bg-gray-600 text-red-600 dark:text-red-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-red-600',
                    transfer: isActive ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-blue-600',
                  };
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={lockedBySplit}
                      title={lockedBySplit
                        ? (t === 'transfer'
                          ? 'Transfers cannot be split — untick the split option first'
                          : 'Remove the split before changing the transaction type')
                        : undefined}
                      onClick={() => {
                        updateField('type', t);
                        updateField('category', '');
                        setCrossTypeCategories(false);
                      }}
                      className={`flex-1 justify-center px-4 py-1.5 rounded-md text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${colors[t]}`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  );
                })}
              </div>
              {(formData.type === 'income' || formData.type === 'expense') && (
                <label className="mt-2 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={crossTypeCategories}
                    onChange={(e) => {
                      setCrossTypeCategories(e.target.checked);
                      updateField('category', '');
                    }}
                    className="mt-0.5"
                  />
                  <span>
                    {formData.type === 'income'
                      ? 'Categorise as an expense — e.g. a refund files under the expense category it refunds, reducing that category’s total.'
                      : 'Categorise as income — file this outgoing under an income category, reducing that category’s total.'}
                  </span>
                </label>
              )}
            </div>

            {/* Amount */}
            <div className="md:col-span-5">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <BanknoteIcon size={16} />
                Amount {formData.accountId && (() => {
                  const selectedAccount = accounts.find(a => a.id === formData.accountId);
                  return selectedAccount ? `(${getCurrencySymbol(selectedAccount.currency)})` : '';
                })()}
              </label>
              <input
                ref={amountInputRef}
                type="text"
                value={formattedAmount}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow numbers, commas, decimal point, and minus sign
                  if (value === '' || value === '-' || /^-?[0-9,]*\.?[0-9]{0,2}$/.test(value)) {
                    setFormattedAmount(value);
                    // Update the underlying numeric value
                    const numericValue = parseFormattedAmount(value);
                    if (numericValue === '' || numericValue === '-' || parseMoneyInput(numericValue) !== null) {
                      updateField('amount', numericValue);
                    }
                  }
                }}
                onBlur={() => {
                  // Reformat on blur to ensure proper formatting
                  if (formData.amount && formData.amount !== '') {
                    setFormattedAmount(formatWithCommas(formData.amount));
                  }
                }}
                onFocus={() => {
                  // Select all text on focus for easy editing
                  if (amountInputRef.current) {
                    amountInputRef.current.select();
                  }
                }}
                placeholder="0.00"
                className={`w-full px-3 py-2 h-[42px] text-right bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                  formData.amount && (parseMoneyInput(formData.amount) ?? 0) < 0
                    ? 'text-red-600 dark:text-red-400'
                    : formData.amount && (parseMoneyInput(formData.amount) ?? 0) > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-900 dark:text-white'
                }`}
                required
              />
            </div>

            {/* Category Selection - Unified Flat List */}
            <div className="md:col-span-12">
              <div className="flex justify-between items-center mb-1">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <TagIcon size={16} />
                  {formData.type === 'transfer' ? 'Transfer To' : splitActive ? 'Split Categories' : 'Category'}
                </label>
                {formData.type !== 'transfer' && (
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(true)}
                    className="text-sm text-primary hover:text-secondary flex items-center gap-1"
                  >
                    <PlusIcon size={14} />
                    Create new category
                  </button>
                )}
              </div>
              {/* Split toggle — edits of income/expense rows only (a NEW row
                  is added single-category first, then split; transfers encode
                  their target in the category and cannot split). */}
              {transaction && formData.type !== 'transfer' && (
                <label className="mb-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSplitMode}
                    onChange={(e) => handleSplitToggle(e.target.checked)}
                  />
                  <span>Split across multiple categories</span>
                </label>
              )}
              {/* Category is deliberately optional for income/expense — an
                  uncategorised transaction sits in the virtual "Uncategorised"
                  bucket. Transfers still require their target account. */}
              {formData.type === 'transfer' ? (
                <select
                  value={formData.category}
                  onChange={(e) => updateField('category', e.target.value)}
                  className="w-full px-3 py-3 sm:py-2 h-12 sm:h-[42px] text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white"
                  required
                  aria-label="Transfer destination account"
                >
                  <option value="">Select account to transfer to</option>
                  {groupedCategories.transferAccounts.map(acct => (
                    <option key={acct.id} value={acct.id}>{acct.name}</option>
                  ))}
                </select>
              ) : splitActive ? (
                /* Split editor: one CategorySelector + amount per line. The
                   remainder line is the live "totals must match" indicator —
                   save stays blocked until it reads exactly zero. */
                <div className="space-y-2">
                  {splitsLoading ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-2">Loading splits…</p>
                  ) : (
                    <>
                      {splitLines.map((line, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <div className="flex-1 min-w-0">
                            <CategorySelector
                              selectedCategory={line.category}
                              onCategoryChange={(id) => updateSplitLine(index, { category: id })}
                              transactionType={
                                crossTypeCategories
                                  ? (formData.type === 'income' ? 'expense' : 'income')
                                  : formData.type
                              }
                              placeholder="Search or select category…"
                              allowCreate={false}
                              showHelperText={false}
                              usePortal
                            />
                          </div>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={line.amount}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || value === '-' || /^-?[0-9,]*\.?[0-9]{0,2}$/.test(value)) {
                                updateSplitLine(index, { amount: value });
                              }
                            }}
                            placeholder="0.00"
                            aria-label={`Split line ${index + 1} amount`}
                            className="w-28 shrink-0 px-3 py-2 h-[42px] text-right bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 dark:text-white"
                          />
                          {splitLines.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeSplitLine(index)}
                              aria-label={`Remove split line ${index + 1}`}
                              title="Remove this split line"
                              className="shrink-0 p-2 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
                            >
                              <XIcon size={18} />
                            </button>
                          )}
                        </div>
                      ))}
                      <div className="flex justify-between items-center pt-1">
                        <button
                          type="button"
                          onClick={addSplitLine}
                          className="text-sm text-primary hover:text-secondary flex items-center gap-1"
                        >
                          <PlusIcon size={14} />
                          Add another category
                        </button>
                        {splitRemaining !== null && (
                          <span
                            className={`text-sm font-medium ${
                              splitRemaining.isZero()
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                            aria-live="polite"
                          >
                            {splitRemaining.isZero()
                              ? 'Fully allocated ✓'
                              : `Remaining to allocate: ${(() => {
                                  const selectedAccount = accounts.find(a => a.id === formData.accountId);
                                  return selectedAccount ? getCurrencySymbol(selectedAccount.currency) : '';
                                })()}${formatWithCommas(splitRemaining.toString())}`}
                          </span>
                        )}
                      </div>
                      {splitValidationMessage && (
                        <p className="text-sm text-red-600 dark:text-red-400">{splitValidationMessage}</p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                /* Searchable combobox: click to type-filter, or use the chevron
                   to browse. usePortal escapes the modal body's overflow-y-auto
                   clipping. Which direction's tree it lists is the transaction's
                   own, flipped by the cross-type toggle (Money-style: a refund
                   can file under an expense). The modal's own "Create new
                   category" button covers creation, so the inline one is off. */
                <CategorySelector
                  selectedCategory={formData.category}
                  onCategoryChange={(id) => updateField('category', id)}
                  transactionType={
                    crossTypeCategories
                      ? (formData.type === 'income' ? 'expense' : 'income')
                      : formData.type
                  }
                  placeholder="Search or select category…"
                  allowCreate={false}
                  showHelperText={false}
                  usePortal
                  allowClear
                />
              )}
            </div>

            {/* Tags */}
            <div className="md:col-span-12">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <HashIcon size={16} />
                Tags
              </label>
              <TagSelector
                selectedTags={formData.tags}
                onTagsChange={(tags) => updateField('tags', tags)}
                placeholder="Search or create tags..."
                allowNewTags={true}
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-12">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <FileTextIcon size={16} />
                Notes
              </label>
              <MarkdownEditor
                value={formData.notes}
                onChange={(value) => updateField('notes', value)}
                placeholder="Add notes... You can use **bold**, *italic*, [links](url), `code`, lists, etc."
                maxHeight="200px"
                className="w-full"
              />
            </div>
            
            {/* Document Attachments */}
            {transaction && (
              <div className="md:col-span-12">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <PaperclipIcon size={16} />
                  Attachments
                </label>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <DocumentManager
                    transactionId={transaction.id}
                    compact
                  />
                </div>
              </div>
            )}

            {/* Status */}
            <div className="md:col-span-12 space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.cleared}
                  onChange={(e) => updateField('cleared', e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <CheckIcon2 size={16} className="text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Reconciled
                </span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!formData.reconciledWith && formData.reconciledWith !== 'manual'}
                  disabled
                  className="rounded border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <LinkIcon size={16} className="text-blue-700 dark:text-blue-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Linked to bank statement
                </span>
              </label>

              {transaction?.reconciledWith && transaction.reconciledWith !== 'manual' && (
                <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400">
                  <LinkIcon size={16} />
                  <span>Reconciled with transaction ID: {transaction.reconciledWith}</span>
                </div>
              )}
            </div>
          </div>
          </ModalBody>
          <ModalFooter>
            {errors?.submit && (
              <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">{errors.submit}</p>
              </div>
            )}
            <div className="flex justify-between gap-3 w-full">
              {transaction && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Delete
                </button>
              )}
              
              <div className="flex gap-3 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                {transaction && onSaveAndPrevious && (
                  <button
                    type="submit"
                    disabled={isSubmitting || splitValidationMessage !== null}
                    onClick={() => { advanceDirectionRef.current = 'previous'; }}
                    className="px-4 py-2 bg-[#2d3a4d] text-white rounded-lg hover:bg-[#3a4a5f] disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Save this transaction and move to the previous one in the list"
                  >
                    Previous
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting || splitValidationMessage !== null}
                  className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving…' : transaction ? 'Save Changes' : 'Add Transaction'}
                </button>
                {transaction && onSaveAndNext && (
                  <button
                    type="submit"
                    disabled={isSubmitting || splitValidationMessage !== null}
                    onClick={() => { advanceDirectionRef.current = 'next'; }}
                    className="px-4 py-2 bg-[#2d3a4d] text-white rounded-lg hover:bg-[#3a4a5f] disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Save this transaction and move to the next one in the list"
                  >
                    Save &amp; Next
                  </button>
                )}
              </div>
            </div>
          </ModalFooter>
        </form>
      </Modal>

        {/* Delete confirmation — portalled: a transformed ancestor would
            re-anchor position:fixed and hide it behind the portalled Modal. */}
        {showDeleteConfirm && createPortal(
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 w-full max-w-md mx-4 shadow-xl">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Delete Transaction?
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to delete this transaction? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Money-style transfer confirmation (match-or-create) */}
        {transaction && transferPrompt && (
          <TransferMatchDialog
            isOpen
            source={transaction}
            sourceAccountName={accounts.find(a => a.id === (formData.accountId || transaction.accountId))?.name ?? 'this account'}
            targetAccountName={accounts.find(a => a.id === transferPrompt.targetAccountId)?.name ?? 'the other account'}
            candidates={transferPrompt.candidates}
            busy={transferBusy}
            onLink={(candidateId) => void completeTransfer(
              () => linkTransferPair(transaction.id, candidateId),
              'Linked as a transfer.'
            )}
            onCreate={() => void completeTransfer(
              () => createTransferCounterpart(transaction.id, transferPrompt.targetAccountId),
              'Transfer created — the other side was added to the target account.'
            )}
            onCancel={() => setTransferPrompt(null)}
          />
        )}

        {/* Category Creation Modal */}
        <CategoryCreationModal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          initialType={formData.type === 'transfer' ? 'expense' : formData.type}
          onCategoryCreated={(categoryId) => {
            // Find the created category and its parent
            const createdCategory = categories.find(c => c.id === categoryId);
            if (createdCategory) {
              if (createdCategory.level === 'detail') {
                updateField('subCategory', createdCategory.parentId || '');
                updateField('category', categoryId);
              } else {
                updateField('subCategory', categoryId);
                updateField('category', '');
              }
            }
            setShowCategoryModal(false);
          }}
        />
    </>
  );
}
