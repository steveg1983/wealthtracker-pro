import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { usePayeeMemory } from '../hooks/usePayeeMemory';
import { XIcon } from './icons';
import CategorySelector from './CategorySelector';
import DatePicker from './common/DatePicker';
import TransferMatchDialog from './TransferMatchDialog';
import SuggestedCategoryBadge from './SuggestedCategoryBadge';
import { findTransferCandidates, type TransferCandidate } from '../utils/transferMatch';
import { isConfirmableSuggestion } from '../utils/categoryProvenance';
import type { Transaction } from '../types';

interface QuickEditTransactionPanelProps {
  transaction: Transaction;
  /** Advance the selection to the next transaction in the visible list. */
  onNext?: () => void;
  onClose: () => void;
  /**
   * A request from the register — F2 — to put the cursor in the first field.
   *
   * Consumed the instant it is honoured (see onFocusFirstFieldHandled), so a
   * request can never be replayed by a later re-mount and steal the cursor
   * from someone who was typing somewhere else entirely.
   */
  focusFirstField?: boolean;
  /** Called once the cursor has landed, so the caller can drop the request. */
  onFocusFirstFieldHandled?: () => void;
  /**
   * Escape in this bar hands the keyboard back to the register, which is
   * still highlighting the row being edited. Without it, F2 is a one-way
   * door: the way back to the arrow keys would be a mouse.
   */
  onReturnToGrid?: () => void;
}

/**
 * One-click batch editor: single-clicking a row in the account register pins
 * this condensed editor under the table — date, description, category, save —
 * so a fresh bank import can be categorised without opening the full modal
 * for every transaction. "Save & Next" walks straight down the list.
 */
export default function QuickEditTransactionPanel({
  transaction,
  onNext,
  onClose,
  focusFirstField = false,
  onFocusFirstFieldHandled,
  onReturnToGrid,
}: QuickEditTransactionPanelProps): React.JSX.Element {
  const {
    transactions,
    accounts,
    categories,
    updateTransaction,
    confirmTransactionCategories,
    linkTransferPair,
    createTransferCounterpart,
  } = useApp();
  const { showError, showSuccess } = useToast();
  const { propagateCategory } = usePayeeMemory();

  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // The Date field's wrapper — the shared DatePicker owns its own input, and
  // this is how F2 reaches it without the page reaching across into another
  // component's DOM by id.
  const dateFieldRef = useRef<HTMLDivElement>(null);
  // Money-style transfer flow: filing under a "To/From <account>" category
  // opens a match-or-create confirmation instead of a plain category write.
  const [transferPrompt, setTransferPrompt] = useState<{
    targetAccountId: string;
    candidates: TransferCandidate[];
  } | null>(null);
  const advanceAfterTransferRef = useRef(false);

  // Re-sync only when a DIFFERENT transaction is selected (Save & Next flow).
  // Keyed by id, not object identity: context refreshes recreate the object
  // and must not clobber what the user is mid-way through typing.
  const lastSyncedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastSyncedIdRef.current === transaction.id) {
      return;
    }
    lastSyncedIdRef.current = transaction.id;
    const d = transaction.date instanceof Date ? transaction.date : new Date(transaction.date);
    setDate(d.toISOString().split('T')[0]);
    setDescription(transaction.description);
    setCategory(transaction.category ?? '');
  }, [transaction]);

  // F2 from the register. The request is honoured once and handed straight
  // back, so nothing about it survives to fire again.
  useEffect(() => {
    if (!focusFirstField) return;
    const input = dateFieldRef.current?.querySelector('input');
    input?.focus();
    input?.select();
    onFocusFirstFieldHandled?.();
  }, [focusFirstField, onFocusFirstFieldHandled]);

  /**
   * Escape gives the register its keys back.
   *
   * defaultPrevented is the guard that makes Escape peel back one layer at a
   * time: an open category menu or calendar answers its own Escape first (and
   * says so by preventing the default), and only an Escape nothing else wanted
   * means "I'm done down here".
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    // The transfer confirmation is a dialog of its own and owns its Escape.
    if (transferPrompt) return;
    e.preventDefault();
    e.stopPropagation();
    onReturnToGrid?.();
  };

  const isTransfer = transaction.type === 'transfer';
  // A split transaction's categorisation lives in its split lines — the DB
  // guard rejects a single-category write, so this panel never sends one.
  const isSplit = transaction.isSplit === true;

  const save = async (advance: boolean) => {
    if (isSaving) return;
    if (!description.trim()) {
      showError(new Error('Description is required.'));
      return;
    }
    const parsedDate = new Date(date);
    if (!date || Number.isNaN(parsedDate.getTime())) {
      showError(new Error('Enter a valid date.'));
      return;
    }
    // Filing under a To/From category = "make this a transfer" (Money-style):
    // save the field edits, then hand over to the match-or-create flow, which
    // owns the category/type change. Never for rows that already are
    // transfers or splits.
    const chosenCategory = categories.find(c => c.id === category);
    if (!isTransfer && !isSplit && !transaction.linkedTransferId &&
        chosenCategory?.isTransferCategory && chosenCategory.accountId) {
      if (chosenCategory.accountId === transaction.accountId) {
        showError(new Error(
          "That's this account's own transfer category — pick the OTHER account's To/From category."
        ));
        return;
      }
      setIsSaving(true);
      try {
        await updateTransaction(transaction.id, {
          date: parsedDate,
          description: description.trim(),
        });
        advanceAfterTransferRef.current = advance;
        setTransferPrompt({
          targetAccountId: chosenCategory.accountId,
          candidates: findTransferCandidates(
            transactions,
            { ...transaction, date: parsedDate, description: description.trim() },
            chosenCategory.accountId
          ),
        });
      } catch (error) {
        showError(error);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setIsSaving(true);
    try {
      const categoryChanged = category !== (transaction.category ?? '');
      await updateTransaction(transaction.id, {
        date: parsedDate,
        description: description.trim(),
        // Saving from this panel is confirmation. The user opened the row, the
        // category was in front of them in the field they are saving, and they
        // either changed it or let it stand — both are answers to "is this
        // right?". Sent explicitly rather than left to the server's "a changed
        // category is a confirmed one" rule, because letting a suggestion
        // stand deliberately is the case that rule cannot see.
        ...(isTransfer || isSplit ? {} : { category, categoryConfirmed: true }),
      });

      // Payee memory — but never for CROSS-TYPE filings (a refund put under an
      // expense category is a one-off correction; teaching it to a mixed-flow
      // payee would stamp expense categories onto all its incoming money).
      const chosenCategory = categories.find(c => c.id === category);
      const isCrossType =
        chosenCategory !== undefined &&
        (chosenCategory.type === 'income' || chosenCategory.type === 'expense') &&
        chosenCategory.type !== transaction.type;

      if (!isTransfer && !isSplit && categoryChanged && category && !isCrossType &&
          (transaction.type === 'income' || transaction.type === 'expense')) {
        await propagateCategory({
          accountId: transaction.accountId,
          description: description.trim(),
          type: transaction.type,
          categoryId: category,
          excludeId: transaction.id,
        });
      }

      if (advance && onNext) {
        onNext();
      }
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  // Complete the transfer flow (link or create), then honour a pending
  // Save & Next. Failures keep the dialog open so the user can retry/cancel.
  const completeTransfer = async (action: () => Promise<unknown>, successMessage: string) => {
    setIsSaving(true);
    try {
      await action();
      showSuccess(successMessage);
      setTransferPrompt(null);
      const advance = advanceAfterTransferRef.current;
      advanceAfterTransferRef.current = false;
      if (advance && onNext) {
        onNext();
      }
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const targetAccountName = transferPrompt
    ? accounts.find(a => a.id === transferPrompt.targetAccountId)?.name ?? 'the other account'
    : '';

  /**
   * Is the category in the box still only the app's guess?
   *
   * Read from the STORED row, not from `category` state: the moment the user
   * picks something else it is their choice, and the "suggested" styling must
   * come off as they do it rather than after a round trip. So a pending edit
   * takes it off immediately.
   */
  const showingSuggestion =
    // Transfers and splits are excluded inside the predicate now, so every
    // surface asks the same question of the same rule.
    isConfirmableSuggestion(transaction) &&
    category === (transaction.category ?? '');

  /**
   * The one-click half of "confirm or edit": agree with the guess exactly as it
   * stands. Writes a single boolean — no category, no amount, no balance — and
   * leaves the panel open so the row visibly settles before moving on.
   */
  const confirmSuggestion = async (): Promise<void> => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await confirmTransactionCategories([transaction.id]);
      showSuccess('Category confirmed.');
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    // data-quick-edit-panel: the register's click-outside-to-deselect handler
    // treats clicks inside this panel as "keep the selection".
    <div
      data-quick-edit-panel
      onKeyDown={handleKeyDown}
      className="mt-3 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 px-4 py-3"
    >
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex items-center gap-2 lg:hidden">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Quick edit</span>
        </div>

        {/* Date */}
        <div ref={dateFieldRef} className="w-full lg:w-40">
          <label htmlFor="quick-edit-date" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Date
          </label>
          {/* The shared dd/mm/yyyy picker, NOT a native date input: natives
              render in the browser's locale, which showed American dates to a
              register displaying UK ones. */}
          <DatePicker
            id="quick-edit-date"
            value={date}
            onChange={setDate}
            className="h-[42px] text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl dark:text-white"
            aria-label="Transaction date"
          />
        </div>

        {/* Description — flex-1 like Category, so the two split the row's
            slack EQUALLY instead of Description hogging it. */}
        <div className="w-full lg:flex-1 lg:min-w-0">
          <label htmlFor="quick-edit-description" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Description
          </label>
          <input
            id="quick-edit-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 h-[42px] text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl dark:text-white"
          />
        </div>

        {/* Category (not editable for transfers — they carry system categories).
            Searchable combobox: click to type-filter, or use the chevron to
            browse the full list. Both directions are offered (Money-style
            cross-type filing — a refund can file under the expense it refunds).
            flex-1 to match Description — the pair share the slack equally. */}
        <div className="w-full lg:flex-1 lg:min-w-0">
          <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Category
            {/* The shared badge (see SuggestedCategoryBadge): amber, the colour
                this app already uses for "this needs your attention", and never
                colour alone — the word carries the meaning for anyone who
                cannot see the hue. The title spells out what happens if it is
                ignored. The register, the phone list and the full editor render
                the very same component, so the row cannot look like a guess in
                one place and a decision in another. */}
            {showingSuggestion && (
              <SuggestedCategoryBadge
                size="field"
                className="ml-2 align-middle"
                title="The app filled this in from what you have filed before. Confirm it, or pick a different category — either way it stops being a guess. Left alone it stays as it is and still counts in your reports."
              />
            )}
          </span>
          {isTransfer ? (
            <div className="w-full px-3 h-[42px] flex items-center text-sm bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-xl text-gray-500 dark:text-gray-400">
              Transfer
            </div>
          ) : isSplit ? (
            <div
              className="w-full px-3 h-[42px] flex items-center text-sm bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-xl text-blue-600 dark:text-blue-400 italic"
              title="Split across multiple categories — open the full editor (double-click the row) to change its splits"
            >
              Split
            </div>
          ) : (
            <CategorySelector
              selectedCategory={category}
              onCategoryChange={setCategory}
              transactionType={transaction.type}
              includeAllTypes
              showHelperText={false}
              placeholder="Search or select category…"
              allowClear
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* "Confirm" only appears when there is a guess to agree with, and it
              sits FIRST because on a freshly imported row it is the action the
              user wants nine times in ten. */}
          {showingSuggestion && (
            <button
              onClick={() => void confirmSuggestion()}
              disabled={isSaving}
              className="px-4 h-[42px] inline-flex items-center justify-center text-sm font-medium bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              title="Agree with the suggested category — nothing else about the transaction changes"
            >
              Confirm
            </button>
          )}
          <button
            onClick={() => void save(false)}
            disabled={isSaving}
            className="px-4 h-[42px] inline-flex items-center justify-center text-sm font-medium bg-[#1a2332] text-white rounded-xl hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          {onNext && (
            <button
              onClick={() => void save(true)}
              disabled={isSaving}
              className="px-4 h-[42px] inline-flex items-center justify-center text-sm font-medium bg-[#2d3a4d] text-white rounded-xl hover:bg-[#3a4a5f] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              title="Save and move to the next transaction in the list"
            >
              Save &amp; Next
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close quick edit"
          >
            <XIcon size={16} />
          </button>
        </div>
      </div>

      {transferPrompt && (
        <TransferMatchDialog
          isOpen
          source={transaction}
          sourceAccountName={accounts.find(a => a.id === transaction.accountId)?.name ?? 'this account'}
          targetAccountName={targetAccountName}
          candidates={transferPrompt.candidates}
          busy={isSaving}
          onLink={(candidateId) => void completeTransfer(
            () => linkTransferPair(transaction.id, candidateId),
            `Linked as a transfer with ${targetAccountName}.`
          )}
          onCreate={() => {
            // Pre-flight the RPC's cross-currency guard so the user gets a
            // clear message without a failed server round-trip.
            const sourceCurrency = accounts.find(a => a.id === transaction.accountId)?.currency;
            const targetCurrency = accounts.find(a => a.id === transferPrompt.targetAccountId)?.currency;
            if (sourceCurrency && targetCurrency && sourceCurrency !== targetCurrency) {
              showError(new Error(
                `Transfers between accounts in different currencies aren't supported yet (${sourceCurrency} and ${targetCurrency}).`
              ));
              return;
            }
            void completeTransfer(
              () => createTransferCounterpart(transaction.id, transferPrompt.targetAccountId),
              `Transfer created — the other side was added to ${targetAccountName}.`
            );
          }}
          onCancel={() => {
            setTransferPrompt(null);
            advanceAfterTransferRef.current = false;
          }}
        />
      )}
    </div>
  );
}
