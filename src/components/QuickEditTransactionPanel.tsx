import React, { useState, useEffect, useRef, useCallback } from 'react';
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

/** The three things in the box that can hold the cursor. */
export type QuickEditField = 'date' | 'description' | 'category';

/**
 * Where the cursor should land in a box that is opening, and how.
 *
 * The box is opened by two different intentions and they want different
 * things, so the request says which rather than leaving the caller to guess.
 */
export interface QuickEditFocusRequest {
  field: QuickEditField;
  /**
   * Let the date field's calendar unfurl as the cursor arrives.
   *
   * F2 says yes: the user has just asked to edit this row, and the calendar is
   * most of what the date field is for. A Save & Next landing says no — the
   * same field, row after row, with a calendar covering the next three
   * transactions every time would hide the very list being worked down.
   */
  openCalendar?: boolean;
}

interface QuickEditTransactionPanelProps {
  transaction: Transaction;
  /**
   * Advance the selection to the next transaction in the visible list, and
   * put the cursor where the run asks for it in the box that opens there.
   *
   * Absent when this is the LAST row: the box then shows no Save & Next at
   * all, and a save ends the run instead of wrapping round to the top.
   */
  onNext?: (landOn: QuickEditFocusRequest) => void;
  /**
   * Close the box — Escape, the ×, or a finished Save — leaving the row itself
   * highlighted.
   *
   * The register hands the keyboard back to the grid when this fires, so the
   * arrow keys carry on from the row that was being edited rather than
   * scrolling the list from a button nobody can see. Escape and the × also
   * discard: any unsaved keystrokes go with them, and the box re-reads the
   * stored transaction when it next opens.
   */
  onDismiss: () => void;
  /**
   * A request from the register — F2, or the landing after a Save & Next — for
   * the cursor to be put in one of the fields.
   *
   * Consumed the instant it is honoured (see onFocusRequestHandled), so a
   * request can never be replayed by a later re-mount and steal the cursor
   * from someone who was typing somewhere else entirely.
   */
  focusRequest?: QuickEditFocusRequest | null;
  /** Called once the cursor has landed, so the caller can drop the request. */
  onFocusRequestHandled?: () => void;
}

/** The YYYY-MM-DD a date input wants, from whatever the row is carrying. */
function toDateInputValue(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().split('T')[0];
}

/**
 * The height of the whole box, in pixels — and the register's row maths
 * depends on it being the truth.
 *
 * The box is drawn inside the virtualised transaction list, which positions
 * rows by arithmetic rather than by measuring them: the row it belongs to is
 * made exactly this much taller, and every row below is pushed down by exactly
 * this much. So the box declares a fixed height and lays its one row of fields
 * out inside it, rather than sizing to its content and hoping.
 */
export const QUICK_EDIT_BOX_HEIGHT = 88;

/**
 * Microsoft Money's inline transaction form: clicking a row in the register
 * opens this box directly beneath THAT row — the rows below move down — with
 * date, description, category and the actions on one line, so a fresh bank
 * import can be worked through without opening the full editor for every
 * transaction.
 *
 * ─ THE RHYTHM ─────────────────────────────────────────────────────────────
 * Filing a statement is the same edit made a hundred times, so the keyboard is
 * shaped around REPEATING one field rather than around finishing one row:
 *
 *   type → Enter (accepts what you typed, and hands you Save & Next)
 *        → Enter (saves, moves to the next row, cursor back in the SAME field)
 *
 * which means a run of categories is: type, Enter, Enter, type, Enter, Enter…
 * without the hand ever leaving the keyboard or the eye leaving the line.
 * Save — the other button — ends the run: it saves, closes the box, and gives
 * the list back the keyboard so the arrows work again. Escape closes without
 * saving. Both of those land on the row that was being edited, still
 * highlighted.
 */
export default function QuickEditTransactionPanel({
  transaction,
  onNext,
  onDismiss,
  focusRequest,
  onFocusRequestHandled,
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

  const [date, setDate] = useState(() => toDateInputValue(transaction.date));
  const [description, setDescription] = useState(transaction.description);
  const [category, setCategory] = useState(transaction.category ?? '');
  /**
   * Which button's write is in flight, or null when none is.
   *
   * Not a bare boolean, because the busy word belongs on the button the user
   * actually pressed: Save & Next is the one a run presses a hundred times, and
   * a box that greys everything out while the OTHER button says "Saving…" is
   * telling the user about a button they did not touch.
   */
  const [savingAction, setSavingAction] = useState<'save' | 'next' | 'confirm' | null>(null);
  const isSaving = savingAction !== null;
  // The Date field's wrapper — the shared DatePicker owns its own input, and
  // this is how F2 reaches it without the page reaching across into another
  // component's DOM by id.
  const panelRef = useRef<HTMLDivElement>(null);
  const dateFieldRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const categoryFieldRef = useRef<HTMLDivElement>(null);
  // Where the cursor goes when a field's Enter accepts what was typed; see the
  // comment on focusRunButton.
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const saveAndNextButtonRef = useRef<HTMLButtonElement>(null);
  // Pulses asking the two pickers for the cursor. They own their own DOM, so a
  // number they watch is how this box asks without reaching into it.
  const [dateFocusToken, setDateFocusToken] = useState(0);
  const [categoryOpenToken, setCategoryOpenToken] = useState(0);
  /**
   * The field the user was last in — the one a Save & Next lands back in.
   *
   * A run down a statement is one field repeated: a hundred categories, or a
   * hundred tidied descriptions. Remembering which turns "next transaction"
   * into "next transaction, ready to carry on", instead of dropping the cursor
   * somewhere the user has to leave again. A ref, not state: nothing on screen
   * depends on it, and it must not cost a render every time focus moves.
   *
   * It only has to last as long as THIS box: the field is handed to the
   * register with the Save & Next, and comes back as the focus request for the
   * box built on the next row — where the cursor landing there sets it again,
   * and the run keeps its own memory alive.
   */
  const lastFieldRef = useRef<QuickEditField | null>(null);
  // Money-style transfer flow: filing under a "To/From <account>" category
  // opens a match-or-create confirmation instead of a plain category write.
  const [transferPrompt, setTransferPrompt] = useState<{
    targetAccountId: string;
    candidates: TransferCandidate[];
  } | null>(null);
  const advanceAfterTransferRef = useRef(false);

  const isTransfer = transaction.type === 'transfer';
  // A split transaction's categorisation lives in its split lines — the DB
  // guard rejects a single-category write, so this panel never sends one.
  const isSplit = transaction.isSplit === true;
  /** Transfers and splits show a read-only word where the picker would be. */
  const canEditCategory = !isTransfer && !isSplit;

  /**
   * Re-read the fields if a DIFFERENT transaction is ever handed to the same
   * box.
   *
   * Keyed by id, not object identity: context refreshes recreate the object
   * every few seconds and must not clobber what the user is mid-way through
   * typing.
   *
   * The register does not in fact reuse the box — it is drawn inside the row it
   * belongs to, so Save & Next builds a fresh one on the next row (measured,
   * not assumed) and the initial state above is what fills it. This is the
   * guard that keeps the box honest for any caller that does reuse it: a box
   * showing one transaction's figures under another transaction's row is the
   * kind of wrong that gets saved.
   *
   * Done during the render rather than in an effect — React's own "adjusting
   * state when a prop changes" — because an effect would set the new values one
   * render LATER, and a cursor landing in between would select the outgoing
   * row's text and have it replaced under the caret.
   */
  const [syncedId, setSyncedId] = useState(transaction.id);
  if (syncedId !== transaction.id) {
    setSyncedId(transaction.id);
    setDate(toDateInputValue(transaction.date));
    setDescription(transaction.description);
    setCategory(transaction.category ?? '');
  }

  /**
   * Put the cursor where the register asked for it.
   *
   * Each field is reached the way its own component allows: the description is
   * this box's own input, the date and the category are shared components that
   * own their DOM and watch a number instead.
   */
  const applyFocusRequest = useCallback((request: QuickEditFocusRequest): void => {
    // A transfer or a split has no category box to land in — the field is a
    // word, not a picker — so the run falls back to the description rather
    // than dropping the cursor on the floor.
    const field = request.field === 'category' && !canEditCategory
      ? 'description'
      : request.field;

    switch (field) {
      case 'description':
        descriptionRef.current?.focus();
        // Selected, not caret-at-end: Money does the same, and a run of
        // descriptions is nearly always a REPLACEMENT ("ASDA STORES 4021" →
        // "Asda"). Typing overwrites; one press of End or → keeps it instead.
        descriptionRef.current?.select();
        return;
      case 'category':
        setCategoryOpenToken(token => token + 1);
        return;
      case 'date':
        if (request.openCalendar) {
          const input = dateFieldRef.current?.querySelector('input');
          input?.focus();
          input?.select();
          return;
        }
        setDateFocusToken(token => token + 1);
        return;
    }
  }, [canEditCategory]);

  // The register's request — F2, or the landing after a Save & Next. Honoured
  // once and handed straight back, so nothing about it survives to fire again.
  useEffect(() => {
    if (!focusRequest) return;
    applyFocusRequest(focusRequest);
    onFocusRequestHandled?.();
  }, [focusRequest, applyFocusRequest, onFocusRequestHandled]);

  /**
   * Remember the field the cursor is in, for the next Save & Next to land in.
   *
   * One capture handler on the box rather than three on the fields: focus
   * arrives in a picker's search input, in a date input, or in this box's own
   * description, and all three are simply "inside that field". Buttons leave it
   * alone — the run remembers the last FIELD, and Save & Next is not one.
   */
  const handleFocusCapture = (e: React.FocusEvent<HTMLDivElement>): void => {
    const target = e.target;
    if (!(target instanceof Node)) return;
    if (dateFieldRef.current?.contains(target)) {
      lastFieldRef.current = 'date';
    } else if (descriptionRef.current?.contains(target)) {
      lastFieldRef.current = 'description';
    } else if (categoryFieldRef.current?.contains(target)) {
      lastFieldRef.current = 'category';
    }
  };

  /**
   * Where a field's Enter hands the cursor: Save & Next while there is a next
   * row, and Save on the last one.
   *
   * Without it the keyboard is simply LOST — the category box closes by
   * unmounting its search field, and focus falls back to the document body,
   * where neither Enter nor Escape reaches this box at all. And it is where the
   * user is going anyway: on a run, the very next thing they do is save and
   * move on, so the second Enter does it without a key change.
   */
  const focusRunButton = useCallback((): void => {
    const button = saveAndNextButtonRef.current ?? saveButtonRef.current;
    button?.focus();
  }, []);

  /**
   * Give the keyboard back after a write that left the box open.
   *
   * Every button here disables itself while a write is in flight, and a browser
   * blurs a button the moment it is disabled — so pressing one drops the cursor
   * on the floor. It does not matter when the box closes on success (the
   * register takes the keyboard back), but it matters twice over when the box
   * stays: after a FAILED save, where the user has to fix something and press
   * again, and after Confirm, whose button disappears with the badge it agreed
   * with. Both used to end with the keyboard on nothing at all.
   *
   * Never when the user has since clicked into a field: the cursor is theirs
   * then, and moving it would be the rudest possible answer to an error.
   */
  const restoreFocusRef = useRef(false);
  useEffect(() => {
    if (isSaving || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    const active = document.activeElement;
    if (active instanceof Node && panelRef.current?.contains(active)) return;
    focusRunButton();
  }, [isSaving, focusRunButton]);

  /**
   * The two keys the box answers to.
   *
   * ENTER ACCEPTS, and hands over Save & Next. It does not save by itself —
   * that changed deliberately, because filing a statement is the same edit made
   * a hundred times and the second Enter is what makes it a run: accept this
   * one, save-and-move-on, land in the same field, carry on typing.
   *
   * Two things own Enter before this does —
   *
   *   - an OPEN category list, where Enter chooses the highlighted option. It
   *     prevents the default, and the choice itself hands the cursor over (see
   *     handleCategoryChange); an Enter that matched nothing is left alone,
   *     because yanking the cursor out of a search that found nothing is the
   *     opposite of helpful;
   *   - a BUTTON, where Enter is the press. Save, Save & Next and Confirm all
   *     do their own thing with it, and running this handler as well would
   *     write the transaction twice in one keystroke.
   *
   * The DATE field is the third, and it is the one exception: it settles a
   * half-typed date and shuts its calendar on its own Enter, marking the key
   * handled — but settling IS the accept, so the cursor moves on from there
   * exactly as it does from the description.
   *
   * ESCAPE closes the box, one layer at a time. An open menu or calendar
   * answers its own Escape first and stops it here; only an Escape nothing
   * else wanted means "I'm done with this row" — and the register then takes
   * the layer after that (a stretched selection, then the highlight itself).
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'Escape' && e.key !== 'Enter') return;
    // The transfer confirmation is a dialog of its own and owns both keys.
    if (transferPrompt) return;

    if (e.key === 'Escape') {
      if (e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      onDismiss();
      return;
    }

    if (e.target instanceof HTMLElement && e.target.closest('button')) return;

    const inDateField = e.target instanceof Node && dateFieldRef.current?.contains(e.target) === true;
    if (e.defaultPrevented && !inDateField) return;
    if (!e.defaultPrevented) {
      e.preventDefault();
      e.stopPropagation();
    }
    focusRunButton();
  };

  /**
   * A chosen category hands the cursor to Save & Next.
   *
   * Without it the keyboard is simply LOST: the category box closes by
   * unmounting its search field, and focus falls back to the document body,
   * where neither Enter nor Escape reaches this box at all. Save & Next is
   * where it belongs anyway — filing categories is the run this box exists
   * for, so the very next keystroke should be the one that files this row and
   * offers the next.
   */
  const handleCategoryChange = (categoryId: string): void => {
    setCategory(categoryId);
    focusRunButton();
  };

  /**
   * What a successful save does next: walk on, or end the run.
   *
   * Save & Next hands the register the field to land in, so the box that opens
   * on the next row is already where the user was typing. Save — and a Save &
   * Next with nowhere to go — closes the box instead and gives the list back
   * the keyboard, so the arrow keys carry on from the row just saved rather
   * than scrolling from a button nobody can see.
   */
  const finishSave = (advance: boolean): void => {
    if (advance && onNext) {
      onNext({ field: lastFieldRef.current ?? 'date', openCalendar: false });
      return;
    }
    onDismiss();
  };

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
      setSavingAction(advance ? 'next' : 'save');
      restoreFocusRef.current = true;
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
        setSavingAction(null);
      }
      return;
    }

    setSavingAction(advance ? 'next' : 'save');
    restoreFocusRef.current = true;
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

      finishSave(advance);
    } catch (error) {
      // Nothing closes and nothing moves on: the box stays exactly as it is,
      // with the edit still in it, so the user can read the message and try
      // again rather than hunt for what they had typed.
      showError(error);
    } finally {
      setSavingAction(null);
    }
  };

  // Complete the transfer flow (link or create), then honour a pending
  // Save & Next. Failures keep the dialog open so the user can retry/cancel.
  const completeTransfer = async (action: () => Promise<unknown>, successMessage: string) => {
    setSavingAction(advanceAfterTransferRef.current ? 'next' : 'save');
    try {
      await action();
      showSuccess(successMessage);
      setTransferPrompt(null);
      const advance = advanceAfterTransferRef.current;
      advanceAfterTransferRef.current = false;
      finishSave(advance);
    } catch (error) {
      showError(error);
    } finally {
      setSavingAction(null);
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
   *
   * Its own button disappears as it succeeds — the badge it agreed with goes,
   * and the button goes with it — so the cursor is handed on to Save & Next,
   * which is what "move on" means from here.
   */
  const confirmSuggestion = async (): Promise<void> => {
    if (isSaving) return;
    setSavingAction('confirm');
    restoreFocusRef.current = true;
    try {
      await confirmTransactionCategories([transaction.id]);
      showSuccess('Category confirmed.');
    } catch (error) {
      showError(error);
    } finally {
      setSavingAction(null);
    }
  };

  return (
    // data-quick-edit-panel: the register's click-outside-to-deselect handler
    // treats clicks inside this panel as "keep the selection".
    //
    // The height is declared once (QUICK_EDIT_BOX_HEIGHT) and reserved by the
    // register, because the virtualised list makes room by arithmetic rather
    // than by measuring; the box then fills what it was given.
    //
    // It is drawn as the bottom half of the highlighted row's card: the same
    // #6B86B3 border the register wears, square at the top and rounded at the
    // foot, and pulled up by the 4px vertical margin the selected row carries
    // (.selected-transaction-row) so the two meet rather than float apart.
    <div
      ref={panelRef}
      data-quick-edit-panel
      onKeyDown={handleKeyDown}
      // Which field the cursor is in, remembered for the next Save & Next to
      // land back in. Capture, so it is heard wherever inside the box focus
      // actually goes.
      onFocusCapture={handleFocusCapture}
      // h-full, not the constant again: the register hands this box a space of
      // exactly QUICK_EDIT_BOX_HEIGHT and the box fills it, so there is one
      // number in one place and no way for the two to disagree.
      className="relative z-20 -mt-1 h-full flex items-center px-4 rounded-b-xl border-x border-b border-[#6B86B3]/60 bg-blue-50/80 dark:bg-blue-900/30 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.12)]"
    >
      <div className="flex w-full min-w-0 items-end gap-3">
        {/* Date */}
        <div ref={dateFieldRef} className="w-40 shrink-0">
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
            // The box sits INSIDE the transaction list, which clips what
            // overflows it: an in-flow calendar would be cut off at the edge of
            // the table, and worst of all near the foot — where the register
            // opens, and where most of this work is done.
            usePortal
            // A Save & Next run landing here wants the field, not the calendar
            // — see the prop's own note. F2 still opens it, because F2 goes
            // through focus() and means "I want to edit this row".
            focusWithoutCalendarToken={dateFocusToken}
          />
        </div>

        {/* Description — flex-1 like Category, so the two split the row's
            slack EQUALLY instead of Description hogging it. */}
        <div className="flex-1 min-w-0">
          <label htmlFor="quick-edit-description" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Description
          </label>
          <input
            id="quick-edit-description"
            ref={descriptionRef}
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
        <div ref={categoryFieldRef} className="flex-1 min-w-0">
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
              onCategoryChange={handleCategoryChange}
              transactionType={transaction.type}
              includeAllTypes
              showHelperText={false}
              placeholder="Search or select category…"
              allowClear
              // Same reason as the calendar above: the list would be clipped by
              // the table it is drawn inside.
              usePortal
              // A category run lands here: the list opens with an empty search
              // and the cursor in it, so the next payee is typed straight away.
              openSearchToken={categoryOpenToken}
            />
          )}
        </div>

        {/* Actions — the small print where the field LABELS are, the buttons
            where the field INPUTS are.

            The owner: "Move the Save & Next and Save buttons below the text and
            the text above. Those buttons should be the same level as date /
            description and category." So this column takes the same two-part
            shape as every field beside it: something small and grey on top,
            something 42px tall underneath, and the box reads as one row of
            controls rather than two staggered ones.

            items-end on the row above is what holds the alignment: whatever
            height the hint takes (it wraps, deliberately — see its own note),
            the buttons stay on the inputs' line because they are the last thing
            in their column. The column holds the same two things it always did,
            so the box is exactly as tall as it was — QUICK_EDIT_BOX_HEIGHT is
            unchanged, and the register's row arithmetic with it. */}
        <div className="flex flex-col items-end gap-1">
          {/* The rhythm nobody would guess, said where it is used, and said as
              consequences rather than key names. Capped and allowed to wrap so
              it never widens this column and squeezes the fields. The printed
              list (? or View ▸ Keyboard shortcuts) carries the rest.

              It changes on the last row because there is nothing to move on to
              there, and a hint that promises a move that cannot happen is worse
              than no hint at all. */}
          <span className="max-w-[15rem] text-right text-[11px] leading-tight text-gray-500 dark:text-gray-400 pr-1">
            {onNext
              ? 'Enter accepts · Enter again saves & moves on · Esc closes'
              : 'Enter accepts · Enter again saves · Esc closes'}
          </span>
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
            {/* Save & Next FIRST, and in the darker primary, because it is the
                button this box is really for: a statement is filed by making
                the same edit a hundred times, and this is the one the cursor
                lands on and the second Enter presses. Save sits beside it as
                the way to STOP — one row, done, back to the list. */}
            {onNext && (
              <button
                ref={saveAndNextButtonRef}
                onClick={() => void save(true)}
                disabled={isSaving}
                className="px-4 h-[42px] inline-flex items-center justify-center text-sm font-medium bg-[#1a2332] text-white rounded-xl hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                title="Save and move to the next transaction, with the cursor back in the field you were last in (Enter)"
              >
                {savingAction === 'next' ? 'Saving…' : 'Save & Next'}
              </button>
            )}
            <button
              ref={saveButtonRef}
              onClick={() => void save(false)}
              disabled={isSaving}
              className="px-4 h-[42px] inline-flex items-center justify-center text-sm font-medium bg-[#2d3a4d] text-white rounded-xl hover:bg-[#3a4a5f] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              title="Save this transaction and close the box — the list gets the keyboard back, on this row"
            >
              {savingAction === 'save' ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={onDismiss}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Close quick edit"
              title="Close this box (Esc) — the row stays highlighted"
            >
              <XIcon size={16} />
            </button>
          </div>
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
