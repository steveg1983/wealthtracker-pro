import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
// The mark every part of this editor wears (data-quick-edit), and the question
// the register asks of it before claiming a key. Written down there because the
// register needs the same answer and neither should own the other's copy.
import { isInsideQuickEdit } from '../utils/quickEditScope';
// The strip's arrow keys. The rule lives with the rest of the register's
// keyboard so the printed shortcut list and the handler cannot drift apart.
import { nextStripButtonIndex } from '../utils/registerShortcuts';
import type { Transaction } from '../types';

/**
 * ─ THE ROW IS THE EDITOR ───────────────────────────────────────────────────
 *
 * Highlighting a row in the register turns the row itself into the form: the
 * Date cell becomes a date picker, the Description cell a text box, the
 * Category cell a combobox — each still in its own column, still under its own
 * header, still the width the user dragged it to. Underneath sits a slim strip
 * carrying Save & Next, Save, the × and the hint (and Confirm, when the
 * category is only the app's guess).
 *
 * It used to be a card BELOW the row that repeated Date, Description and
 * Category as a second set of fields — so the same three values appeared twice,
 * one line apart, in different places and at different widths, and the eye had
 * to work out which of the two it was reading. The owner: make the row itself
 * the editor. There is nothing to reconcile now, because there is only one of
 * each value on screen.
 *
 * Payment, Deposit, Balance, R and Tags stay as they read. Amounts belong to
 * the full editor — one editor per thing, and a register you can retype a
 * balance into is a register nobody can trust.
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
 * Save — the other button — ends the run: it saves, closes the editor, and
 * gives the list back the keyboard so the arrows work again. Escape closes
 * without saving. Both leave the row that was being edited still highlighted.
 *
 * ─ WHY A PROVIDER AND TWO CONSUMERS ────────────────────────────────────────
 * The editor is now spread across two places the table renders — cells inside
 * the row, and a strip in the row's detail — and one component cannot render
 * into two disjoint places. So the state, the keys and the writes live in a
 * provider mounted ABOVE the table, and the cells and the strip read them from
 * context.
 *
 * That the provider sits above the table rather than inside it is not
 * incidental. Typing in the description must not re-render eleven thousand
 * rows: the provider re-renders, its children element is the same object, React
 * bails out of the table, and only the three cells and the strip — its
 * consumers — are redrawn. The provider is also mounted ALWAYS, editor or no
 * editor, because a wrapper that comes and goes changes the type of the tree
 * beneath it, and this register has already been through what that does to a
 * virtualised list (see VirtualizedTable's note on component identity).
 */

/** The three things in the row that can hold the cursor. */
export type QuickEditField = 'date' | 'description' | 'category';

/**
 * Where the cursor should land in an editor that is opening, and how.
 *
 * The editor is opened by two different intentions and they want different
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

/**
 * How tall the row's own line is while it is the editor, in px.
 *
 * ─ THE ARITHMETIC, AND WHY THESE TWO NUMBERS ───────────────────────────────
 * The fields are 36px — between the add dock's 32px and the old card's 42px,
 * and the tallest that fits a register row's own 8px of vertical cell padding
 * without the cells (which clip) cutting the inputs off: 36 + 8 + 8 = 52.
 *
 * A plain row is 44px, so being edited costs a row 8px of extra height, and the
 * strip below it 36 more: 44 more altogether, where the old card below the row
 * was 88. Half, which is what the owner asked for — and the whole expanded row
 * now stands 88px tall, exactly what the card ALONE used to take.
 *
 * Declared here rather than measured because the virtualised list positions
 * rows by adding heights up: a row that quietly grew is a row every row below
 * it is painted over by.
 */
export const QUICK_EDIT_ROW_HEIGHT = 52;

/** How tall the strip beneath the edited row is, in px. See above. */
export const QUICK_EDIT_STRIP_HEIGHT = 36;

/** The YYYY-MM-DD a date input wants, from whatever the row is carrying. */
function toDateInputValue(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().split('T')[0];
}

/**
 * The field a focus request can actually be honoured in.
 *
 * Two things take fields away. A transfer or a split has no category to pick —
 * its category is a system one, or lives in its split lines — and any column
 * can be switched off in the View menu, editor and all. Falling back to the
 * description keeps the old behaviour for the common case (a run of categories
 * meeting a transfer) and keeps the cursor somewhere it can be typed for the
 * rest.
 */
function resolveField(
  wanted: QuickEditField,
  available: readonly QuickEditField[]
): QuickEditField | null {
  if (available.includes(wanted)) return wanted;
  if (available.includes('description')) return 'description';
  return available[0] ?? null;
}

/** Which button's write is in flight, or null when none is. */
type SavingAction = 'save' | 'next' | 'confirm' | null;

interface QuickEditRowContextValue {
  transaction: Transaction;
  fields: readonly QuickEditField[];
  date: string;
  setDate: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  category: string;
  chooseCategory: (categoryId: string) => void;
  dateFocusToken: number;
  categoryOpenToken: number;
  showingSuggestion: boolean;
  savingAction: SavingAction;
  hasNext: boolean;
  dateFieldRef: React.RefObject<HTMLDivElement>;
  descriptionRef: React.RefObject<HTMLInputElement>;
  saveButtonRef: React.RefObject<HTMLButtonElement>;
  saveAndNextButtonRef: React.RefObject<HTMLButtonElement>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  noteFocus: (field: QuickEditField) => void;
  requestSave: (advance: boolean) => void;
  confirmSuggestion: () => void;
  dismiss: () => void;
}

const QuickEditRowContext = createContext<QuickEditRowContextValue | null>(null);

function useQuickEditRow(): QuickEditRowContextValue {
  const value = useContext(QuickEditRowContext);
  if (!value) {
    throw new Error(
      'A quick-edit cell was rendered outside QuickEditRowProvider — the editor and the row it edits must be in one tree.'
    );
  }
  return value;
}

export interface QuickEditRowProviderProps {
  /**
   * The transaction whose row IS the editor, or null when no row is being
   * edited. Null keeps the provider mounted and renders nothing: see the note
   * at the top on why this wrapper never comes and goes.
   */
  transaction: Transaction | null;
  /**
   * Which of the three fields have a column to sit in, in the order the
   * register draws them. A column switched off in the View menu takes its
   * editor with it — the full editor still reaches every field — and the run
   * lands somewhere that exists (see resolveField).
   */
  fields?: readonly QuickEditField[];
  /**
   * Advance the selection to the next transaction in the visible list, and put
   * the cursor where the run asks for it in the editor that opens there.
   *
   * Absent when this is the LAST row: the strip then shows no Save & Next at
   * all, and a save ends the run instead of wrapping round to the top.
   */
  onNext?: (landOn: QuickEditFocusRequest) => void;
  /**
   * Stop editing — Escape, the ×, or a finished Save — leaving the row itself
   * highlighted.
   *
   * The register hands the keyboard back to the grid when this fires, so the
   * arrow keys carry on from the row that was being edited rather than
   * scrolling the list from a button nobody can see. Escape and the × also
   * discard: any unsaved keystrokes go with them, and the fields re-read the
   * stored transaction when the row is next opened.
   */
  onDismiss: () => void;
  /**
   * A request from the register — F2, or the landing after a Save & Next — for
   * the cursor to be put in one of the fields.
   *
   * Consumed the instant it is honoured (see onFocusRequestHandled), so a
   * request can never be replayed and steal the cursor from someone who was
   * typing somewhere else entirely.
   */
  focusRequest?: QuickEditFocusRequest | null;
  /** Called once the cursor has landed, so the caller can drop the request. */
  onFocusRequestHandled?: () => void;
  children: React.ReactNode;
}

const ALL_FIELDS: readonly QuickEditField[] = ['date', 'description', 'category'];

export function QuickEditRowProvider({
  transaction,
  fields = ALL_FIELDS,
  onNext,
  onDismiss,
  focusRequest,
  onFocusRequestHandled,
  children,
}: QuickEditRowProviderProps): React.JSX.Element {
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

  const [date, setDate] = useState(() => (transaction ? toDateInputValue(transaction.date) : ''));
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [category, setCategory] = useState(transaction?.category ?? '');
  /**
   * Which button's write is in flight, or null when none is.
   *
   * Not a bare boolean, because the busy word belongs on the button the user
   * actually pressed: Save & Next is the one a run presses a hundred times, and
   * an editor that greys everything out while the OTHER button says "Saving…"
   * is telling the user about a button they did not touch.
   */
  const [savingAction, setSavingAction] = useState<SavingAction>(null);
  const isSaving = savingAction !== null;

  // The Date cell's wrapper — the shared DatePicker owns its own input, and
  // this is how F2 reaches it without the page reaching across into another
  // component's DOM by id.
  const dateFieldRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  // Where the cursor goes when a field's Enter accepts what was typed; see the
  // comment on focusRunButton.
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const saveAndNextButtonRef = useRef<HTMLButtonElement>(null);
  // Pulses asking the two pickers for the cursor. They own their own DOM, so a
  // number they watch is how the editor asks without reaching into it.
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
   * It lasts as long as the RUN, which is why it is cleared when the editor
   * closes and not when it merely moves to the next row.
   */
  const lastFieldRef = useRef<QuickEditField | null>(null);
  // Money-style transfer flow: filing under a "To/From <account>" category
  // opens a match-or-create confirmation instead of a plain category write.
  const [transferPrompt, setTransferPrompt] = useState<{
    targetAccountId: string;
    candidates: TransferCandidate[];
  } | null>(null);
  const advanceAfterTransferRef = useRef(false);

  const isTransfer = transaction?.type === 'transfer';
  // A split transaction's categorisation lives in its split lines — the DB
  // guard rejects a single-category write, so this editor never sends one.
  const isSplit = transaction?.isSplit === true;

  /**
   * Re-read the fields when the editor moves to a DIFFERENT transaction.
   *
   * Keyed by id, not object identity: context refreshes recreate the object
   * every few seconds and must not clobber what the user is mid-way through
   * typing.
   *
   * This is what carries a Save & Next: the provider outlives the hop (only the
   * cells are rebuilt, on the next row), so without this the next row would be
   * shown the row before's figures — and shown them in fields the user is one
   * keystroke away from saving.
   *
   * Done during the render rather than in an effect — React's own "adjusting
   * state when a prop changes" — because an effect would set the new values one
   * render LATER, and a cursor landing in between would select the outgoing
   * row's text and have it replaced under the caret.
   */
  const targetId = transaction?.id ?? null;
  const [syncedId, setSyncedId] = useState<string | null>(targetId);
  if (syncedId !== targetId) {
    setSyncedId(targetId);
    setDate(transaction ? toDateInputValue(transaction.date) : '');
    setDescription(transaction?.description ?? '');
    setCategory(transaction?.category ?? '');
    // The run is over when the editor closes; the next one starts its own
    // memory rather than inheriting where the last one happened to end.
    if (targetId === null) lastFieldRef.current = null;
  }

  /**
   * Where a field's Enter hands the cursor: Save & Next while there is a next
   * row, and Save on the last one.
   *
   * Without it the keyboard is simply LOST — the category box closes by
   * unmounting its search field, and focus falls back to the document body,
   * where neither Enter nor Escape reaches the editor at all. And it is where
   * the user is going anyway: on a run, the very next thing they do is save and
   * move on, so the second Enter does it without a key change.
   */
  const focusRunButton = useCallback((): void => {
    const button = saveAndNextButtonRef.current ?? saveButtonRef.current;
    button?.focus();
  }, []);

  /**
   * Put the cursor where the register asked for it.
   *
   * Each field is reached the way its own component allows: the description is
   * the editor's own input, the date and the category are shared components
   * that own their DOM and watch a number instead.
   */
  const applyFocusRequest = useCallback((request: QuickEditFocusRequest): void => {
    const field = resolveField(request.field, fields);
    if (!field) {
      // Every editable column switched off. There is still a row to save, so
      // the cursor goes where the next Enter is useful rather than nowhere.
      focusRunButton();
      return;
    }
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
  }, [fields, focusRunButton]);

  // The register's request — F2, or the landing after a Save & Next. Honoured
  // once and handed straight back, so nothing about it survives to fire again.
  useEffect(() => {
    if (!focusRequest) return;
    if (transaction) applyFocusRequest(focusRequest);
    onFocusRequestHandled?.();
  }, [focusRequest, transaction, applyFocusRequest, onFocusRequestHandled]);

  /** Remember the field the cursor is in, for the next Save & Next to land in. */
  const noteFocus = useCallback((field: QuickEditField): void => {
    lastFieldRef.current = field;
  }, []);

  /**
   * Give the keyboard back after a write that left the editor open.
   *
   * Every button here disables itself while a write is in flight, and a browser
   * blurs a button the moment it is disabled — so pressing one drops the cursor
   * on the floor. It does not matter when the editor closes on success (the
   * register takes the keyboard back), but it matters twice over when it stays:
   * after a FAILED save, where the user has to fix something and press again,
   * and after Confirm, whose button disappears with the badge it agreed with.
   * Both used to end with the keyboard on nothing at all.
   *
   * Never when the user has since clicked into a field: the cursor is theirs
   * then, and moving it would be the rudest possible answer to an error.
   */
  const restoreFocusRef = useRef(false);
  useEffect(() => {
    if (isSaving || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    if (isInsideQuickEdit(document.activeElement)) return;
    focusRunButton();
  }, [isSaving, focusRunButton]);

  /**
   * What a successful save does next: walk on, or end the run.
   *
   * Save & Next hands the register the field to land in, so the editor that
   * opens on the next row is already where the user was typing. Save — and a
   * Save & Next with nowhere to go — closes the editor instead and gives the
   * list back the keyboard, so the arrow keys carry on from the row just saved
   * rather than scrolling from a button nobody can see.
   */
  const finishSave = useCallback((advance: boolean): void => {
    if (advance && onNext) {
      onNext({ field: lastFieldRef.current ?? 'date', openCalendar: false });
      return;
    }
    onDismiss();
  }, [onNext, onDismiss]);

  const save = useCallback(async (advance: boolean): Promise<void> => {
    if (!transaction || isSaving) return;
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
          // Reviewed, even though the transfer half of this save has not
          // happened yet: this write COMMITTED the user's field edits, and it
          // was a save button that made it. Cancelling the transfer dialog
          // leaves those edits in place, so leaving the row bold afterwards
          // would call an edit the user made and kept "not looked at".
          needsReview: false,
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
        // A SAVE IS A REVIEW. This is the whole of the Microsoft Money rule the
        // register's bold implements: the row stops being new when a save
        // button commits it, and not a moment before. Opening the editor and
        // pressing Escape leaves this unsent, so the row stays bold and the
        // counter stays where it was — reading a row is not the same as
        // finishing with it.
        //
        // Sent explicitly, and only from here and the three other save buttons,
        // because no server-side rule could tell this write apart from a bulk
        // categorise sweep or a payee rename passing through the same door.
        needsReview: false,
        // Saving from the row is confirmation. The user opened it, the category
        // was in front of them in the cell they are saving, and they either
        // changed it or let it stand — both are answers to "is this right?".
        // Sent explicitly rather than left to the server's "a changed category
        // is a confirmed one" rule, because letting a suggestion stand
        // deliberately is the case that rule cannot see.
        ...(isTransfer || isSplit ? {} : { category, categoryConfirmed: true }),
      });

      // Payee memory — but never for CROSS-TYPE filings (a refund put under an
      // expense category is a one-off correction; teaching it to a mixed-flow
      // payee would stamp expense categories onto all its incoming money).
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
      // Nothing closes and nothing moves on: the row stays exactly as it is,
      // with the edit still in it, so the user can read the message and try
      // again rather than hunt for what they had typed.
      showError(error);
    } finally {
      setSavingAction(null);
    }
  }, [
    transaction, isSaving, description, date, category, categories, isTransfer, isSplit,
    transactions, updateTransaction, propagateCategory, finishSave, showError,
  ]);

  const requestSave = useCallback((advance: boolean): void => {
    void save(advance);
  }, [save]);

  /**
   * The two keys the editor answers to.
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
   *     chooseCategory); an Enter that matched nothing is left alone, because
   *     yanking the cursor out of a search that found nothing is the opposite
   *     of helpful;
   *   - a BUTTON, where Enter is the press. Save, Save & Next and Confirm all
   *     do their own thing with it, and running this handler as well would
   *     write the transaction twice in one keystroke.
   *
   * The DATE field is the third, and it is the one exception: it settles a
   * half-typed date and shuts its calendar on its own Enter, marking the key
   * handled — but settling IS the accept, so the cursor moves on from there
   * exactly as it does from the description.
   *
   * ESCAPE closes the editor, one layer at a time. An open menu or calendar
   * answers its own Escape first and stops it here; only an Escape nothing else
   * wanted means "I'm done with this row" — and the register then takes the
   * layer after that (a stretched selection, then the highlight itself).
   *
   * Attached to each of the editor's parts rather than to one wrapper round
   * them all, because there is no such wrapper any more: the fields are cells
   * of the row and the buttons are a strip beneath it.
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>): void => {
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

    if (e.target instanceof Element && e.target.closest('button')) return;

    const inDateField = e.target instanceof Node && dateFieldRef.current?.contains(e.target) === true;
    if (e.defaultPrevented && !inDateField) return;
    if (!e.defaultPrevented) {
      e.preventDefault();
      e.stopPropagation();
    }
    focusRunButton();
  }, [transferPrompt, onDismiss, focusRunButton]);

  /**
   * A chosen category hands the cursor to Save & Next.
   *
   * Without it the keyboard is simply LOST: the category box closes by
   * unmounting its search field, and focus falls back to the document body,
   * where neither Enter nor Escape reaches the editor at all. Save & Next is
   * where it belongs anyway — filing categories is the run this editor exists
   * for, so the very next keystroke should be the one that files this row and
   * offers the next.
   */
  const chooseCategory = useCallback((categoryId: string): void => {
    setCategory(categoryId);
    focusRunButton();
  }, [focusRunButton]);

  // Complete the transfer flow (link or create), then honour a pending
  // Save & Next. Failures keep the dialog open so the user can retry/cancel.
  const completeTransfer = useCallback(async (
    action: () => Promise<unknown>,
    successMessage: string
  ): Promise<void> => {
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
  }, [finishSave, showSuccess, showError]);

  /**
   * The one-click half of "confirm or edit": agree with the guess exactly as it
   * stands. Writes a single boolean — no category, no amount, no balance — and
   * leaves the editor open so the row visibly settles before moving on.
   *
   * Its own button disappears as it succeeds — the badge it agreed with goes,
   * and the button goes with it — so the cursor is handed on to Save & Next,
   * which is what "move on" means from here.
   */
  const confirmSuggestion = useCallback((): void => {
    if (!transaction || isSaving) return;
    const id = transaction.id;
    setSavingAction('confirm');
    restoreFocusRef.current = true;
    void (async (): Promise<void> => {
      try {
        await confirmTransactionCategories([id]);
        showSuccess('Category confirmed.');
      } catch (error) {
        showError(error);
      } finally {
        setSavingAction(null);
      }
    })();
  }, [transaction, isSaving, confirmTransactionCategories, showSuccess, showError]);

  /**
   * Is the category in the cell still only the app's guess?
   *
   * Read from the STORED row, not from `category` state: the moment the user
   * picks something else it is their choice, and the "suggested" marking must
   * come off as they do it rather than after a round trip. So a pending edit
   * takes it off immediately.
   */
  const showingSuggestion =
    // Transfers and splits are excluded inside the predicate, so every surface
    // asks the same question of the same rule.
    transaction !== null &&
    isConfirmableSuggestion(transaction) &&
    category === (transaction.category ?? '');

  const targetAccountName = transferPrompt
    ? accounts.find(a => a.id === transferPrompt.targetAccountId)?.name ?? 'the other account'
    : '';

  const value = useMemo<QuickEditRowContextValue | null>(() => {
    if (!transaction) return null;
    return {
      transaction,
      fields,
      date,
      setDate,
      description,
      setDescription,
      category,
      chooseCategory,
      dateFocusToken,
      categoryOpenToken,
      showingSuggestion,
      savingAction,
      hasNext: onNext !== undefined,
      dateFieldRef,
      descriptionRef,
      saveButtonRef,
      saveAndNextButtonRef,
      handleKeyDown,
      noteFocus,
      requestSave,
      confirmSuggestion,
      dismiss: onDismiss,
    };
  }, [
    transaction, fields, date, description, category, chooseCategory,
    dateFocusToken, categoryOpenToken, showingSuggestion, savingAction, onNext,
    handleKeyDown, noteFocus, requestSave, confirmSuggestion, onDismiss,
  ]);

  return (
    <QuickEditRowContext.Provider value={value}>
      {children}
      {/* The confirmation is drawn from here, not from the strip: it is a
          full-screen dialog about the whole edit, and the strip lives inside a
          table that clips what overflows it. */}
      {transaction && transferPrompt && (
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
    </QuickEditRowContext.Provider>
  );
}

/**
 * One cell of the row, while the row is the editor.
 *
 * Everything the three have in common lives here: the mark that tells the
 * register these keys are not its own, the Enter/Escape handler, the note of
 * which field the cursor is in (for the next Save & Next to land back in), and
 * the click that must NOT reach the row underneath — a click on the row while
 * its editor is open means "give me the full editor", and typing into the
 * description is not that.
 *
 * ─ WHY EACH SHELL EATS ITS CELL'S PADDING ──────────────────────────────────
 * `-mx-3 -my-2` cancels the padding the table puts on every cell, and each
 * shell then puts back whatever inset it wants. Two things come of that. The
 * shell covers the WHOLE cell, so aiming at the description box and missing it
 * by three pixels types rather than opening the full editor over what you were
 * about to type. And a column too narrow for its field — the 100px Date one —
 * can hand the field the pixels the padding was holding.
 *
 * Nothing is clipped by it: overflow is clipped at the padding box, which is
 * exactly where a shell that has cancelled its cell's padding ends.
 */
function QuickEditCellShell({
  field,
  cellRef,
  className = '',
  children,
}: {
  field: QuickEditField;
  cellRef?: React.RefObject<HTMLDivElement>;
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const { handleKeyDown, noteFocus } = useQuickEditRow();
  return (
    <div
      ref={cellRef}
      data-quick-edit={field}
      onKeyDown={handleKeyDown}
      // Capture, so it is heard wherever inside the field focus actually goes —
      // a picker's search box, a date input, the description itself.
      onFocusCapture={() => noteFocus(field)}
      onClick={(e) => e.stopPropagation()}
      // The vertical inset is put straight back (the field is 36px in a 52px
      // row); the horizontal is each field's own, because the Date column has
      // none to spare. No flex: a block child fills the width on its own, and
      // both pickers are blocks that size their own input to it.
      className={`-mx-3 -my-2 py-2 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * The Date, Description or Category cell of the row being edited — the control
 * in the place the value was being read, under its own column header.
 */
export function QuickEditFieldCell({ field }: { field: QuickEditField }): React.JSX.Element {
  const {
    transaction, date, setDate, description, setDescription, category, chooseCategory,
    dateFocusToken, categoryOpenToken, dateFieldRef, descriptionRef,
  } = useQuickEditRow();

  if (field === 'date') {
    return (
      // The register's narrowest column, and a dd/mm/yyyy date is a fixed ten
      // characters of it. So this field keeps four pixels of inset (px-1) where
      // its neighbours keep twelve, and the calendar glyph is dropped (see
      // DatePicker's showIcon) because the 32px it reserves is worth more here
      // as date.
      //
      // Those four pixels are a TERM in the column's width sum — see
      // registerDateColumn, which owns the arithmetic and is held to it by a
      // test that reads this very class name back off the DOM. Widening this
      // inset narrows the date.
      <QuickEditCellShell field="date" cellRef={dateFieldRef} className="px-1">
        {/* The shared dd/mm/yyyy picker, NOT a native date input: natives
            render in the browser's locale, which showed American dates to a
            register displaying UK ones. */}
        <DatePicker
          value={date}
          onChange={setDate}
          size="sm"
          showIcon={false}
          className="h-[36px] text-sm font-normal bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white"
          aria-label="Transaction date"
          // The cell sits INSIDE the transaction list, which clips what
          // overflows it: an in-flow calendar would be cut off at the edge of
          // the table, and worst of all near the foot — where the register
          // opens, and where most of this work is done.
          usePortal
          // A Save & Next run landing here wants the field, not the calendar —
          // see the prop's own note. F2 still opens it, because F2 goes through
          // focus() and means "I want to edit this row".
          focusWithoutCalendarToken={dateFocusToken}
        />
      </QuickEditCellShell>
    );
  }

  if (field === 'description') {
    return (
      <QuickEditCellShell field="description" className="px-3 min-w-0">
        {/* Named rather than labelled: the column header IS the label here, and
            a screen reader reading a grid cell says the column with it — but
            the name has to be unambiguous on its own, because the add bar at
            the foot of the page has a Description too. */}
        <input
          ref={descriptionRef}
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-label="Transaction description"
          className="w-full px-2 h-[36px] text-sm font-normal bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white"
        />
      </QuickEditCellShell>
    );
  }

  return (
    // Searchable combobox: click to type-filter, or use the chevron to browse
    // the full list. Both directions are offered (Money-style cross-type filing
    // — a refund can file under the expense it refunds).
    //
    // Transfers and splits never reach here: the register leaves their Category
    // cell exactly as it reads, because a transfer's category follows the
    // account it faces and a split's lives in its lines.
    <QuickEditCellShell field="category" className="px-3 min-w-0">
      <CategorySelector
        selectedCategory={category}
        onCategoryChange={chooseCategory}
        transactionType={transaction.type}
        includeAllTypes
        showHelperText={false}
        placeholder="Search or select category…"
        allowClear
        // Same reason as the calendar above: the list would be clipped by the
        // table it is drawn inside.
        usePortal
        // Matches the 36px the row grows to while it is being edited.
        size="row"
        // A category run lands here: the list opens with an empty search and
        // the cursor in it, so the next payee is typed straight away.
        openSearchToken={categoryOpenToken}
      />
    </QuickEditCellShell>
  );
}

/**
 * The strip under the row being edited: what you can do, and the two-Enter
 * rhythm that does it.
 *
 * Everything that is not a field lives here, and nothing that IS one — no
 * repeated Date, no second Description. That is the whole change: the strip is
 * 36px where the card it replaced was 88, and the row it belongs to has grown
 * 8px to hold its own fields.
 *
 * Enter in a field lands the cursor on Save & Next; the arrows then walk along
 * the rest of the strip, so ending a run on one row is Enter, →, Enter. See
 * moveAlongStrip.
 */
export function QuickEditActionStrip(): React.JSX.Element {
  const {
    showingSuggestion, savingAction, hasNext, saveButtonRef, saveAndNextButtonRef,
    handleKeyDown, requestSave, confirmSuggestion, dismiss,
  } = useQuickEditRow();
  const isSaving = savingAction !== null;
  const stripRef = useRef<HTMLDivElement>(null);

  /**
   * The arrows, while the cursor is on one of these buttons: step along the
   * strip. See nextStripButtonIndex for the rule and why it cannot disturb the
   * fields above or the list behind.
   *
   * Read off the DOM rather than from a list of refs, because which buttons
   * exist changes with the row — Confirm only on a guessed category, Save &
   * Next only when there is a next row — and a hand-kept list is one that will
   * one day be missing the button someone just added. Disabled buttons (a save
   * in flight) are skipped: the browser will not focus them anyway.
   *
   * Tab still reaches every button exactly as it did. These arrows are a
   * shorter way round for anyone who knows them, not the only way in.
   */
  const moveAlongStrip = useCallback((e: React.KeyboardEvent<HTMLDivElement>): boolean => {
    const container = stripRef.current;
    if (!container || !(e.target instanceof Element)) return false;
    const from = e.target.closest('button');
    if (!from || !container.contains(from)) return false;
    const buttons = Array.from(container.querySelectorAll('button')).filter(b => !b.disabled);
    const to = nextStripButtonIndex(buttons.indexOf(from), buttons.length, e.key);
    if (to === null) return false;
    // Claimed, not merely acted on: an unclaimed ArrowRight scrolls the table
    // sideways under the editor the user is looking at.
    e.preventDefault();
    e.stopPropagation();
    buttons[to].focus();
    return true;
  }, []);

  return (
    // data-quick-edit: the register's own keyboard stands down for anything
    // inside the editor (see isInsideQuickEdit) — Space on Save must press the
    // button, not reconcile the row.
    //
    // Drawn as the bottom half of the highlighted row's card: the same #6B86B3
    // border the register wears, square at the top and rounded at the foot, and
    // pulled up by the 4px vertical margin the selected row carries
    // (.selected-transaction-row) so the two meet rather than float apart.
    //
    // bg-blue-50/80 and dark:bg-blue-900/30 are the SAME two values
    // .selected-transaction-row fills the row with — one card, one colour,
    // across the join and across the width. Change one and change the other.
    <div
      ref={stripRef}
      data-quick-edit="actions"
      onKeyDown={(e) => {
        // The arrows first, and only if they were the strip's: everything else
        // — Enter, Escape — is the editor's own, unchanged.
        if (moveAlongStrip(e)) return;
        handleKeyDown(e);
      }}
      className="relative z-20 -mt-1 h-full flex items-center justify-between gap-3 px-3 rounded-b-xl border-x border-b border-[#6B86B3]/60 bg-blue-50/80 dark:bg-blue-900/30 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.12)]"
    >
      {/* The rhythm nobody would guess, said where it is used, and said as
          consequences rather than key names. One line: the strip is as wide as
          the register, so what used to wrap in a narrow column now reads
          straight across. The printed list (? or View ▸ Keyboard shortcuts)
          carries the rest.

          It changes on the last row because there is nothing to move on to
          there, and a hint that promises a move that cannot happen is worse
          than no hint at all. */}
      <span className="min-w-0 truncate text-[11px] font-normal text-gray-500 dark:text-gray-400">
        {hasNext
          ? 'Enter accepts · Enter again saves & moves on · Esc closes'
          : 'Enter accepts · Enter again saves · Esc closes'}
      </span>

      <div className="flex shrink-0 items-center gap-2">
        {/* The guess, and the one click that agrees with it. The badge says in
            words what the amber says in colour — the register's own Category
            column carries the identical one on rows that are not being edited,
            so nothing changes meaning as an editor opens. */}
        {showingSuggestion && (
          <>
            <SuggestedCategoryBadge
              size="field"
              title="The app filled this in from what you have filed before. Confirm it, or pick a different category — either way it stops being a guess. Left alone it stays as it is and still counts in your reports."
            />
            <button
              type="button"
              onClick={confirmSuggestion}
              disabled={isSaving}
              className="px-3 h-[28px] inline-flex items-center justify-center text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              title="Agree with the suggested category — nothing else about the transaction changes"
            >
              Confirm
            </button>
          </>
        )}
        {/* Save & Next FIRST, and in the darker primary, because it is the
            button this editor is really for: a statement is filed by making the
            same edit a hundred times, and this is the one the cursor lands on
            and the second Enter presses. Save sits beside it as the way to STOP
            — one row, done, back to the list. */}
        {hasNext && (
          <button
            type="button"
            ref={saveAndNextButtonRef}
            onClick={() => requestSave(true)}
            disabled={isSaving}
            className="px-3 h-[28px] inline-flex items-center justify-center text-xs font-medium bg-[#1a2332] text-white rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            title="Save and move to the next transaction, with the cursor back in the field you were last in (Enter)"
          >
            {savingAction === 'next' ? 'Saving…' : 'Save & Next'}
          </button>
        )}
        <button
          type="button"
          ref={saveButtonRef}
          onClick={() => requestSave(false)}
          disabled={isSaving}
          className="px-3 h-[28px] inline-flex items-center justify-center text-xs font-medium bg-[#2d3a4d] text-white rounded-lg hover:bg-[#3a4a5f] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          title="Save this transaction and stop editing — the list gets the keyboard back, on this row. From Save & Next, the right arrow reaches this button."
        >
          {savingAction === 'save' ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="h-[28px] w-[28px] inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/60"
          aria-label="Stop editing this row"
          title="Stop editing this row (Esc) — it stays highlighted"
        >
          <XIcon size={14} />
        </button>
      </div>
    </div>
  );
}
