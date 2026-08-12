import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { useTransactionNotifications } from '../hooks/useTransactionNotifications';
import { usePayeeMemory } from '../hooks/usePayeeMemory';
import { CalendarIcon, TagIcon, FileTextIcon, CheckIcon2, LinkIcon, PlusIcon, HashIcon, WalletIcon, ArrowRightLeftIcon, ArrowUpRightIcon, BanknoteIcon, PaperclipIcon, XIcon } from '../components/icons';
import type { Transaction, TransferDisplacedDisposition } from '../types';
import {
  splitRemainder,
  validateSplitDrafts,
  signSplitAmounts,
  displaySplitAmount,
  type SplitLineDraft,
} from '../utils/transactionSplits';
import CategoryCreationModal from './CategoryCreationModal';
import TransferMatchDialog from './TransferMatchDialog';
import TransferRepointDialog from './TransferRepointDialog';
import DeleteTransactionConfirm from './DeleteTransactionConfirm';
import SuggestedCategoryBadge from './SuggestedCategoryBadge';
import { isConfirmableSuggestion } from '../utils/categoryProvenance';
import { findTransferCandidates, transferCategoryFor, type TransferCandidate } from '../utils/transferMatch';
import { isTransferFiling } from '../utils/transferCoherence';
import { describeCounterpartOrigin } from '../utils/transferCounterpartOrigin';
import { describeDeleteStranding, resolveTransferOtherSide } from '../utils/transferOtherSide';
import { deleteTransferPair } from '../utils/transferSurvivorRelease';
import { buildTransactionRegisterPath } from '../utils/transactionDeepLink';
import AccountSelector from './common/AccountSelector';
import DatePicker from './common/DatePicker';
import { useToast } from '../contexts/ToastContext';
import CategorySelector from './CategorySelector';
import TagSelector from './TagSelector';
import { getCurrencySymbol } from '../utils/currency';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import MoneyInput from './common/MoneyInput';
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
  /**
   * The account whose own register is hosting this modal. "See this
   * transaction in <account>" is suppressed for it — offering a jump to where
   * the user already is would be noise. Passed by the host rather than
   * guessed from the URL, which cannot tell a register from a modal over it.
   */
  hideJumpToAccountId?: string;
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

export default function EditTransactionModal({ isOpen, onClose, transaction, defaultAccountId, onSaveAndNext, onSaveAndPrevious, hideJumpToAccountId }: EditTransactionModalProps): React.JSX.Element {
  const { accounts, categories, transactions, updateTransaction, deleteTransaction, getTransactionSplits, setTransactionSplits, linkTransferPair, createTransferCounterpart, repointTransfer } = useApp();
  const { showSuccess, showError, showWarning } = useToast();
  const { addTransaction } = useTransactionNotifications();
  const { propagateCategory } = usePayeeMemory();
  const navigate = useNavigate();
  const location = useLocation();
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
  /**
   * The re-point that is waiting on an answer about the counterpart it would
   * displace, or null when there is nothing to ask.
   *
   * Only ever set when the counterpart could NOT be proved to be scaffolding
   * this app created — see transferCounterpartOrigin, which can prove that and
   * nothing else, and errs towards asking.
   */
  const [repointPrompt, setRepointPrompt] = useState<{
    targetAccountId: string;
    counterpart: Transaction | null;
    reasons: string[];
  } | null>(null);
  // A Save & Next interrupted by that question must still advance once it is
  // answered; the direction was already consumed by the submit that opened it.
  const advanceAfterRepointRef = useRef<'next' | 'previous' | null>(null);
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

          // RE-POINTING. Changing a linked transfer's target used to be refused
          // outright ("delete the transfer and recreate it"), which left the
          // dropdown above offering a choice the save would then reject — and
          // the only exit anybody found destroyed a row. It is now a real
          // operation: repointTransfer moves the pair, atomically, re-filing
          // both sides. The transfer facts are stripped out of the ordinary
          // update below, because they belong to that one write.
          const repointTargetId = transaction?.linkedTransferId && isNewTransferSelection &&
            targetAccountId && targetAccountId !== transaction.transferAccountId
            ? targetAccountId
            : undefined;

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
            const splitError = validateSplitDrafts(data.amount, splitLines, {
              parentType: resolvedType as 'income' | 'expense',
              directionFor: splitDirectionFor,
              parentAccountId: validatedData.accountId,
              isTransferCategory,
            });
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
              reconciledWith: data.reconciledWith.trim() || undefined,
              // See REVIEW below: this write committed the field edits, so the
              // row has been dealt with even if the transfer dialog after it is
              // cancelled.
              needsReview: false
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
                conversionTargetId,
                undefined,
                // The accounts are what let this see the other side of a
                // CONVERTED transfer: opposite in sign, any magnitude, because
                // the ratio between the magnitudes is the rate that was
                // achieved. Without them the exact-amount rule stands.
                { accounts }
              ),
            });
            return;
          }

          /**
           * The transfer filings the conversion above CANNOT rescue.
           *
           * `conversionTargetId` resolves from the category's own `accountId`,
           * which the account-managed "To/From <account>" categories always
           * carry. The two legacy sentinels under the Transfer type root
           * (transfer-in / transfer-out) do not — they say "this is a transfer"
           * and never say to where — and neither does a transfer category whose
           * account has been removed from underneath it.
           *
           * Saved as-is, such a row would be typed income or expense and filed
           * as a transfer: `classifyFlow` reads the CATEGORY, so it would be
           * dropped from every report while still moving the balance, and it
           * would not appear in the uncategorised review band either, because
           * it has a real category id. Nothing would ever ask about it again.
           *
           * So the save refuses and says what to do instead. This is the only
           * shape the editor cannot fix for the user, because the missing fact
           * — which account the money went to — is one only they know.
           */
          if (
            !splitting &&
            // A LINKED row is not stranded: its other side exists, and every
            // report treating it as a transfer is right to. There is nothing to
            // create, so refusing an unrelated edit to it (a note, a date)
            // would block work for no gain.
            !transaction?.linkedTransferId &&
            resolvedType !== 'transfer' &&
            isTransferFiling(chosenCategoryObj)
          ) {
            throw new Error(
              'That category files this as a transfer but doesn’t name an account, so there is no other side to create. Switch the type to Transfer and choose the account the money moved to.'
            );
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
          // REVIEW. A save button pressed on an existing row ends its review:
          // the whole transaction was on screen, the user read it and committed
          // it, which is exactly what the register's bold is asking for. Sent
          // explicitly and only from the save buttons, because nothing on the
          // server could tell this write apart from a bulk sweep coming through
          // the same door — see the note on updateTransaction in dataPort.ts.
          //
          // Harmless on a CREATE (addTransaction below): a row somebody typed
          // is born reviewed anyway, so the field agrees with the column
          // default rather than fighting it.
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
            reconciledWith: data.reconciledWith.trim() || undefined,
            needsReview: false
          };

          // Await the writes so a failed RPC surfaces via the form's submit
          // error instead of silently closing the modal (fire-and-forget bug).
          if (transaction) {
            if (splitting) {
              // A split parent's amount/category/type are guarded by a DB
              // trigger — only the split RPCs may change them. The ordinary
              // update carries everything else; the RPC then writes the split
              // lines (matching them to the stored ones by id, so a line that
              // is half of a transfer survives an edit to its neighbours),
              // re-validates the sum against the entered amount server-side,
              // and syncs amount + account balance.
              await updateTransaction(transaction.id, {
                date: transactionData.date,
                description: transactionData.description,
                accountId: transactionData.accountId,
                tags: transactionData.tags,
                notes: transactionData.notes,
                cleared: transactionData.cleared,
                reconciledWith: transactionData.reconciledWith,
                needsReview: transactionData.needsReview
              });
              await setTransactionSplits(
                transaction.id,
                signSplitAmounts(splitLines, resolvedType as 'income' | 'expense', splitDirectionFor),
                signedAmount
              );
            } else if (transaction.isSplit) {
              // Un-split FIRST — while is_split the guard trigger rejects the
              // category/amount this update carries.
              await setTransactionSplits(transaction.id, [], null);
              await updateTransaction(transaction.id, transactionData);
            } else if (repointTargetId) {
              // The ordinary edits, MINUS the three facts the re-point owns.
              // Sending the new category and target here would half-apply the
              // move: this row would face the new account while its other half
              // still sat in the old one, which is the very disagreement the
              // atomic operation exists to prevent.
              const { category: _repointed, transferAccountId: _moved, type: _typed, ...fieldEdits } = transactionData;
              await updateTransaction(transaction.id, fieldEdits);
              // Either the counterpart is provably ours and moves without
              // ceremony, or the user is asked what to do with it — in which
              // case the editor stays open and the dialog finishes the job.
              if (await beginRepoint(transaction, repointTargetId)) {
                advanceAfterRepointRef.current = advanceDirection;
                suppressCloseRef.current = true;
                return;
              }
            } else {
              await updateTransaction(transaction.id, transactionData);
            }
          } else {
            const created = await addTransaction(transactionData);

            /**
             * A NEW transfer's other side — through the one operation that
             * LINKS it.
             *
             * This used to be a second, independent addTransaction: two rows
             * that looked like a transfer and were not one. Neither carried
             * linkedTransferId, so nothing tied them together — the editor
             * reported "no other side recorded" on a pair that was sitting
             * right there, re-pointing could not move them, and deleting one
             * left the other stranded in an account nobody was looking at.
             *
             * createTransferCounterpart writes the other row, types both as
             * transfers, files both under the opposite account's To/From
             * category, links them each way and moves the target balance —
             * atomically, in the cloud and in the browser store alike.
             *
             * The compensating delete is the same promise the register's dock
             * makes: both legs, or neither. Left in place, the first leg is a
             * payment out of an account with nothing to answer for it.
             */
            if (isNewTransferSelection && targetAccountId) {
              try {
                await createTransferCounterpart(created.id, targetAccountId);
              } catch (counterpartError) {
                await deleteTransaction(created.id);
                throw counterpartError;
              }
            }
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

  // Transfer targets: every active account except the one this transaction
  // sits in. The option carries 'transfer:<id>' because the target rides in
  // the category field until save resolves it. `institution` comes along so
  // the picker can band and find them by bank, as the Accounts page does.
  const transferTargetOptions = useMemo(
    () => accounts
      .filter(a => a.isActive !== false && a.id !== formData.accountId)
      .map(a => ({ id: `transfer:${a.id}`, name: a.name, type: a.type, institution: a.institution })),
    [accounts, formData.accountId]
  );

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

  // A split line's DIRECTION comes from its category's tree: an income
  // category inside an expense split counts AGAINST the total (a £30,000
  // payment can be £40,000 of expense and £10,000 of income). Neutral
  // categories (Revaluation etc., type 'both') follow the parent.
  // Declared before the splits-loading effect below, which depends on it.
  const splitDirectionFor = useCallback((categoryId: string): 'income' | 'expense' | null => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat || cat.type === 'both') return null;
    return cat.type;
  }, [categories]);

  // Picking a "To/From <account>" category on a split line IS the sentence
  // "this part of the money moved to that account" — the same rule the
  // whole-transaction conversion follows. The account it names becomes the
  // line's transfer target; any other category clears it.
  const splitTransferTargetFor = useCallback((categoryId: string): string | undefined => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.isTransferCategory === true ? cat.accountId : undefined;
  }, [categories]);

  const isTransferCategory = useCallback(
    (categoryId: string): boolean =>
      categories.find(c => c.id === categoryId)?.isTransferCategory === true,
    [categories]
  );

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
          const parentDirection = transaction.type === 'income' ? 'income' : 'expense';
          // Each line converts back using ITS OWN direction (its category's
          // tree), so a mixed split round-trips to positive magnitudes.
          // Identity and leg fields come from the stored row and travel back
          // out untouched: the writer matches lines by id, and a line already
          // linked to a counterpart may not change.
          setSplitLines(splits.map(s => ({
            id: s.id,
            category: s.category,
            amount: displaySplitAmount(s.amount, splitDirectionFor(s.category) ?? parentDirection),
            ...(s.memo ? { memo: s.memo } : {}),
            ...(s.transferAccountId
              ? { transferAccountId: s.transferAccountId, savedTransferAccountId: s.transferAccountId }
              : {}),
            ...(s.linkedTransferId ? { linkedTransferId: s.linkedTransferId } : {}),
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
  }, [transaction, getTransactionSplits, logger, splitDirectionFor]);

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

  /**
   * Re-file one line. The transfer target is derived from the category rather
   * than stored twice: choosing "To/From Savings" makes the line a leg to
   * Savings, choosing anything else stops it being one. (A line already linked
   * to a counterpart never reaches here — the editor renders it read-only.)
   */
  const changeSplitLineCategory = (index: number, categoryId: string): void => {
    const target = splitTransferTargetFor(categoryId);
    setSplitLines(prev => prev.map((line, i) => {
      if (i !== index) return line;
      const { transferAccountId: _replaced, ...rest } = line;
      return { ...rest, category: categoryId, ...(target ? { transferAccountId: target } : {}) };
    }));
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
  // One of these lines is already half of a transfer with another account.
  // That line is read-only and the split cannot be un-split (un-splitting
  // deletes every line, stranding the row on the other side) — but every
  // OTHER line stays editable, which is what the writer's line matching buys.
  const splitHasLinkedLeg = splitLines.some(line => Boolean(line.linkedTransferId));
  const splitDirectionOpts = {
    parentType: (formData.type === 'income' ? 'income' : 'expense') as 'income' | 'expense',
    directionFor: splitDirectionFor,
    parentAccountId: formData.accountId,
    isTransferCategory,
  };
  const splitValidationMessage = splitActive
    ? validateSplitDrafts(formData.amount, splitLines, splitDirectionOpts)
    : null;
  const splitRemaining = splitActive
    ? splitRemainder(formData.amount, splitLines, splitDirectionOpts)
    : null;

  /**
   * Move a linked transfer to a different account — or stop and ask first.
   *
   * Returns true when it asked (the caller then keeps the editor open and the
   * dialog owns what happens next), false when the move is already done.
   *
   * WHY THERE IS A QUESTION AT ALL. Re-pointing takes the counterpart with it.
   * That is right when the counterpart is scaffolding this app inserted for the
   * user, and wrong when it is a row off a bank statement — dragging that into
   * another account puts two registers out by its amount and leaves a
   * reconciliation that can never be made to balance. describeCounterpartOrigin
   * can PROVE the first case and never the second, so anything it cannot prove
   * is asked about. The cost of asking unnecessarily is one click; the cost of
   * not asking is discovered months later.
   */
  const beginRepoint = async (source: Transaction, targetAccountId: string): Promise<boolean> => {
    const counterpart = transactions.find(t => t.id === source.linkedTransferId) ?? null;
    const verdict = counterpart
      ? describeCounterpartOrigin(counterpart)
      // Not in the loaded set at all — it sits in a closed account, or the list
      // is stale. Nothing can be proved about a row that is not here.
      : {
          systemCreated: false,
          reasons: ['it is not loaded — it sits in an account that is closed, so what it is cannot be checked'],
        };

    if (verdict.systemCreated) {
      await repointTransfer(source.id, targetAccountId, 'move');
      showSuccess('Transfer moved — the other side went with it.');
      return false;
    }

    setRepointPrompt({ targetAccountId, counterpart, reasons: verdict.reasons });
    return true;
  };

  /**
   * Finish a re-point the user has answered, then leave the way the save that
   * started it would have. A failure keeps the dialog up so they can retry or
   * back out with nothing half-done.
   */
  const completeRepoint = async (
    disposition: TransferDisplacedDisposition,
    successMessage: string
  ): Promise<void> => {
    if (!transaction || !repointPrompt) return;
    setTransferBusy(true);
    try {
      await repointTransfer(transaction.id, repointPrompt.targetAccountId, disposition);
      showSuccess(successMessage);
      setRepointPrompt(null);
      const advance = advanceAfterRepointRef.current;
      advanceAfterRepointRef.current = null;
      if (advance === 'next' && onSaveAndNext) {
        onSaveAndNext();
      } else if (advance === 'previous' && onSaveAndPrevious) {
        onSaveAndPrevious();
      } else {
        onClose();
      }
    } catch (error) {
      logger.error('Transfer re-point failed', error as Error);
      showError(error);
    } finally {
      setTransferBusy(false);
    }
  };

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

  // Money's "go to the other half of this transfer". Both legs are linked, so
  // the button appears on each and points back at the other.
  const otherSide = useMemo(
    () => resolveTransferOtherSide(transaction, transactions, accounts),
    [transaction, transactions, accounts]
  );

  /**
   * The account the picker is pointing at that the transfer is NOT yet pointing
   * at — the pending re-point — or null when the two agree.
   *
   * Only for a linked pair: an unlinked transfer's target is an ordinary field
   * and saving it needs no explanation, while a linked one's save moves a row
   * in an account that is not on screen.
   */
  const pendingRepointName = useMemo(() => {
    if (!transaction?.linkedTransferId) return null;
    if (!formData.category.startsWith('transfer:')) return null;
    const pending = formData.category.slice('transfer:'.length);
    if (!pending || pending === transaction.transferAccountId) return null;
    return accounts.find(a => a.id === pending)?.name ?? 'the chosen account';
  }, [transaction, formData.category, accounts]);

  // Every jump out of this modal works the same way: close the editor (so it
  // isn't left hanging over the register it just opened), then deep-link the
  // row. Taken even when the account is CLOSED — the register itself owns the
  // closed-account offer (name, explanation, "Re-open and view"), so the way
  // through arrives where the user asked for it instead of being described.
  const jumpToRegister = useCallback((accountId: string, transactionId: string): void => {
    onClose();
    navigate(buildTransactionRegisterPath(accountId, transactionId, location.search));
  }, [navigate, location.search, onClose]);

  // `isOpen` shapes the transfer label only — a closed account's name isn't in
  // the context list to print.
  const handleJumpToOtherSide = (): void => {
    if (!otherSide) return;
    jumpToRegister(otherSide.accountId, otherSide.transactionId);
  };

  // "See this transaction in <account>": the same mechanic pointed at the
  // row's OWN account, for the context the edit screen can't give — the
  // surrounding rows and the running balance. The SAVED account is the target,
  // not the form's current pick, because that is where the row is right now.
  const ownAccountJump = useMemo(() => {
    if (!transaction || transaction.accountId === hideJumpToAccountId) return null;
    const account = accounts.find(a => a.id === transaction.accountId);
    return {
      accountId: transaction.accountId,
      transactionId: transaction.id,
      // A closed account is absent from the loaded list, so the label goes
      // generic rather than blank; the register handles the rest on arrival.
      label: account
        ? `See this transaction in ${account.name}`
        : 'See this transaction in its account',
    };
  }, [transaction, accounts, hideJumpToAccountId]);

  /**
   * Is the category in the picker still only the app's guess?
   *
   * Read from the STORED row, exactly as the quick-edit panel does — provenance
   * is a fact about what is saved, not about what is currently typed into a
   * form. The second half is what makes it live: the moment the user picks
   * something else it is their choice, and the badge comes off as they make it
   * rather than after a save and a round trip.
   *
   * `splitActive` and the transfer check keep it off the two shapes where the
   * field is not a single category to agree with at all.
   */
  const showingSuggestion =
    transaction !== null &&
    formData.type !== 'transfer' &&
    !splitActive &&
    isConfirmableSuggestion(transaction) &&
    formData.category === (transaction.category ?? '');

  // What deleting this row would leave behind in the other account. Null for an
  // ordinary transaction, and then the confirmation says nothing extra.
  const deleteStranding = useMemo(
    () => describeDeleteStranding(transaction, transactions, accounts),
    [transaction, transactions, accounts]
  );

  /**
   * A closed editor owns no dialogs.
   *
   * Callers differ, and a caller is free to keep this mounted with
   * isOpen=false rather than unmounting it (the register unmounts; the retired
   * global transactions list did not, which is how this was found). Where it
   * stays mounted, a delete confirmation left standing outlived the editor it
   * belonged to — and now that the confirmation traps focus, that would strand
   * the user in a dialog about a form they can no longer see. Clearing the flag
   * also stops a stale one springing open the next time the editor is opened.
   */
  useEffect(() => {
    if (!isOpen) {
      setShowDeleteConfirm(false);
      // Same reason, and the stakes are higher: this one moves money between
      // two accounts, and a dialog outliving the editor it belongs to would be
      // asking about a form the user can no longer see.
      setRepointPrompt(null);
      advanceAfterRepointRef.current = null;
    }
  }, [isOpen]);

  /**
   * Delete, then leave — unchanged.
   *
   * Where focus lands afterwards is worth stating, because two restorations
   * meet here. The confirmation returns focus to whatever opened it (this
   * modal's Delete button), and the Modal returns focus to whatever was focused
   * before it opened (the register grid, the transactions table). Closing takes
   * the Delete button with it, so restoring to a detached element is a no-op
   * and the Modal's restoration is the one that lands: the user comes back to
   * the list they deleted from. Cancelling, where the editor stays, puts focus
   * back on its Delete button as it should.
   */
  const handleDelete = async (): Promise<void> => {
    if (!transaction) return;
    // Closing first, and everything before the first await runs synchronously,
    // so this behaves exactly as the fire-and-forget version did — except that
    // a delete which fails now says so instead of leaving an unhandled
    // rejection and a row the user believes is gone.
    onClose();
    try {
      await deleteTransaction(transaction.id);
    } catch (error) {
      showError(error);
    }
  };

  /**
   * Delete the whole movement — this row and the leg facing it.
   *
   * The editor closes on the same terms as a single delete: the row the user
   * was editing is gone either way, and holding a form open over a deleted row
   * is worse than leaving. Anything that goes wrong is reported afterwards by
   * the shared sequencer, which is also where the wording lives — a delete
   * reached through the editor must not describe its own failure differently
   * from the identical delete reached from the register.
   */
  const handleDeleteBothSides = async (): Promise<void> => {
    const otherSide = deleteStranding?.deletableOtherSide;
    if (!transaction || !otherSide) return;
    onClose();
    const result = await deleteTransferPair(
      transaction,
      otherSide,
      deleteStranding?.accountName,
      { deleteTransaction }
    );
    if (result.kind === 'nothing-deleted') showError(result.error);
    // showWarning, not showError: getUserFriendlyError swaps any message over
    // 100 characters for "An error occurred", and the sentence naming which
    // side survived is the entire point of reporting this at all.
    if (result.kind === 'one-deleted') showWarning(result.message, 'Only one side was deleted');
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
              {/* The shared dd/mm/yyyy picker, NOT a native date input: a
                  native renders in the BROWSER's locale, so a row the
                  register showed as 07/02/2022 opened here as 02/07/2022.
                  min-w-0 keeps the box inside the grid column its siblings
                  stop at. */}
              <DatePicker
                value={formData.date}
                onChange={(val) => updateField('date', val)}
                className="min-w-0 h-12 sm:h-[42px] text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white"
                required
                aria-label="Transaction date"
              />
            </div>

            {/* Account */}
            <div className="md:col-span-7">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <WalletIcon size={16} />
                Account
              </label>
              {/* Searchable, banded combobox — the same control as the
                  category picker below. usePortal escapes the modal body's
                  overflow-y-auto clipping; the box keeps this row's own
                  styling so it still matches the date field beside it. */}
              <AccountSelector
                accounts={accounts}
                selectedAccountId={formData.accountId}
                onAccountChange={(accountId) => updateField('accountId', accountId)}
                placeholder="Search or select account…"
                formatLabel={(acc) => `${acc.name} (${acc.type})`}
                className="w-full px-3 py-3 sm:py-2 h-12 sm:h-[42px] text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white"
                usePortal
                required
              />
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
              {/* Hidden in split mode: split lines always offer BOTH trees,
                  so there is no whole-transaction tree to flip. */}
              {(formData.type === 'income' || formData.type === 'expense') && !splitActive && (
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
                  {/* The same badge the register and the quick-edit panel show,
                      so a row cannot look like a guess in one place and the
                      user's own choice in another. Display only: there is no
                      Confirm button here because saving IS the confirmation —
                      the update path records a category the user looked at and
                      let stand, or changed, as one they vouch for. */}
                  {showingSuggestion && (
                    <SuggestedCategoryBadge
                      size="field"
                      title="The app filled this in. Saving records that you have checked it — leave it as it is, or pick a different category."
                    />
                  )}
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
                <label className={`mb-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 ${
                  splitHasLinkedLeg ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                }`}>
                  <input
                    type="checkbox"
                    checked={isSplitMode}
                    // Un-splitting deletes every line, and one of these lines is
                    // half of a transfer — the row on the other side would be
                    // left pointing at nothing.
                    disabled={splitHasLinkedLeg}
                    title={splitHasLinkedLeg
                      ? 'One of these lines is a transfer — delete that transfer first to un-split this transaction'
                      : undefined}
                    onChange={(e) => handleSplitToggle(e.target.checked)}
                  />
                  <span>Split across multiple categories</span>
                </label>
              )}
              {/* Category is deliberately optional for income/expense — an
                  uncategorised transaction sits in the virtual "Uncategorised"
                  bucket. Transfers still require their target account. */}
              {formData.type === 'transfer' ? (
                <>
                  {/* This picker sits in the SAME slot the category picker
                      occupies for an income/expense row, so it wears the same
                      box: choosing the other side of a transfer should feel
                      exactly like choosing a category, not like a different
                      app. Type to filter across seventy accounts by name or
                      by bank. */}
                  <AccountSelector
                    accounts={transferTargetOptions}
                    selectedAccountId={formData.category}
                    onAccountChange={(target) => updateField('category', target)}
                    placeholder="Search or select account to transfer to…"
                    usePortal
                    required
                    ariaLabel="Transfer destination account"
                  />
                  {/* WHAT SAVING WILL DO, when the dropdown above no longer
                      agrees with where the other half actually is.

                      This is the disagreement that used to make the field
                      unreadable: the picker showed the account you had just
                      chosen, the jump line underneath named the old one, and
                      the save then refused both. The picker and the jump line
                      are answering DIFFERENT questions and both answers are
                      right — one is a pending choice, the other is a fact about
                      a row in another account — so the fix is to say so, in the
                      gap between them, rather than to make one of them lie. */}
                  {pendingRepointName && (
                    <p className="mt-2 text-xs text-blue-700 dark:text-blue-400">
                      Saving moves this transfer to {pendingRepointName}. Its other half goes with
                      it, unless it looks like a real transaction — then you will be asked what to
                      do with it first.
                    </p>
                  )}
                  {/* Both halves of a linked transfer carry this, so it reads
                      the same whichever leg is open — and the register's ?txn
                      deep link selects, centres and docks the row on arrival.

                      It names the account the counterpart is in RIGHT NOW,
                      taken from the stored rows and never from the form: this
                      is a way to go and look at something, and it has to be
                      true of the thing it is about to open. After a save it
                      names the new account, because the re-point wrote both
                      rows and the state was updated from what it wrote. */}
                  {otherSide && (
                    <>
                      <button
                        type="button"
                        onClick={handleJumpToOtherSide}
                        title={otherSide.isOpen
                          ? 'Open the matching transaction in its own account'
                          : 'That account is closed — the register will offer to re-open it'}
                        className="mt-2 inline-block text-sm font-medium text-primary hover:text-secondary"
                      >
                        {otherSide.accountName
                          ? `Jump to the other side in ${otherSide.accountName} →`
                          : 'Jump to the other side →'}
                      </button>
                      {/* A button's title is not announced (its label wins), so
                          what to expect on the other end is said out loud. */}
                      {!otherSide.isOpen && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          That account is closed — the register will offer to re-open it.
                        </p>
                      )}
                    </>
                  )}
                </>
              ) : splitActive ? (
                /* Split editor: one CategorySelector + amount per line. The
                   remainder line is the live "totals must match" indicator —
                   save stays blocked until it reads exactly zero. */
                <div className="space-y-2">
                  {splitsLoading ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-2">Loading splits…</p>
                  ) : (
                    <>
                      {splitLines.map((line, index) => {
                        // A line already linked to a transaction in another
                        // account is structural: its category, amount and
                        // target are pinned by that row, so it is SHOWN, not
                        // edited. Every other line on the split stays free —
                        // which is the whole point of being able to open this
                        // at all.
                        const lockedLeg = Boolean(line.linkedTransferId);
                        const legAccountName = line.transferAccountId
                          ? accounts.find(a => a.id === line.transferAccountId)?.name
                          : undefined;
                        return (
                        <div key={line.id ?? `new-${index}`} className="space-y-1">
                          <div className="flex gap-2 items-center">
                            <div className="flex-1 min-w-0">
                              {lockedLeg ? (
                                <div
                                  className="w-full px-3 py-2 h-[42px] flex items-center rounded-xl bg-gray-100 dark:bg-gray-700/60 border border-gray-300/50 dark:border-gray-600/50 text-sm text-gray-700 dark:text-gray-300 truncate"
                                  title="This line is one half of a transfer — delete that transfer to change it"
                                >
                                  {legAccountName
                                    ? `Transfer — ${legAccountName}`
                                    : 'Transfer — the linked account'}
                                </div>
                              ) : (
                                <CategorySelector
                                  selectedCategory={line.category}
                                  onCategoryChange={(id) => changeSplitLineCategory(index, id)}
                                  transactionType={formData.type}
                                  // BOTH trees, per line: a split may mix expense
                                  // and income lines (an income line counts
                                  // against an expense total), so every line
                                  // offers every category and the line's
                                  // direction follows the one chosen.
                                  includeAllTypes
                                  // …and the To/From account categories, which
                                  // make THIS LINE one leg of a transfer. Only
                                  // split lines offer them: a whole transaction
                                  // becomes a transfer via the Type toggle.
                                  includeTransferTargets
                                  transferSourceAccountId={formData.accountId}
                                  placeholder="Search or select category…"
                                  allowCreate={false}
                                  showHelperText={false}
                                  usePortal
                                />
                              )}
                            </div>
                            {lockedLeg ? (
                              <div
                                className="w-28 shrink-0 px-3 py-2 h-[42px] flex items-center justify-end rounded-xl bg-gray-100 dark:bg-gray-700/60 border border-gray-300/50 dark:border-gray-600/50 text-gray-700 dark:text-gray-300"
                                aria-label={`Split line ${index + 1} amount`}
                              >
                                {formatWithCommas(line.amount)}
                              </div>
                            ) : (
                              <MoneyInput
                                value={line.amount}
                                onChange={(raw) => updateSplitLine(index, { amount: raw })}
                                // A MINUS line is legitimate here (cashback inside a
                                // shop reduces the total), so negatives stay enterable.
                                allowNegative
                                aria-label={`Split line ${index + 1} amount`}
                                className="w-28 shrink-0 px-3 py-2 h-[42px] text-right bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 dark:text-white"
                              />
                            )}
                            {splitLines.length > 2 && !lockedLeg && (
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
                            {/* The removed button's width, kept, so a locked
                                line's amount stays in the same column. */}
                            {splitLines.length > 2 && lockedLeg && (
                              <span className="shrink-0 w-[34px]" aria-hidden="true" />
                            )}
                          </div>
                          {/* What this line MEANS, said once: money leaving for
                              (or arriving from) a named account, not a category
                              — and exactly what saving will do about it. */}
                          {line.transferAccountId && (
                            <p className="flex items-center gap-1.5 pl-1 text-xs text-blue-700 dark:text-blue-400">
                              <ArrowRightLeftIcon size={12} />
                              <span>
                                {lockedLeg
                                  ? `Transfer with ${legAccountName ?? 'the linked account'} — its other side is already recorded there, so this line can't change. Delete that transfer to edit it.`
                                  : line.transferAccountId === line.savedTransferAccountId
                                    // Already a leg, but its counterpart is gone
                                    // (deleted, or never imported). Saving must
                                    // NOT make a new one: the row that matches it
                                    // may be sitting in that account unmatched,
                                    // and inventing a second would double the
                                    // movement.
                                    ? `Transfer with ${legAccountName ?? 'that account'} — the matching transaction there is missing. Saving leaves this line as it is; nothing new is created.`
                                    : `Transfer with ${legAccountName ?? 'that account'} — saving creates the matching transaction there.`}
                              </span>
                            </p>
                          )}
                        </div>
                        );
                      })}
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
                {/* "Marked", not "Reconciled": this box writes the WORKING flag
                    (Money's C), the same one the register's Space key and the
                    reconciliation checkbox write. Only finalizing a
                    reconciliation reconciles anything, and a box that claimed
                    otherwise is how marking came to pass for settled work. */}
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Marked against a statement
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

              {/* IS THIS ROW HALF OF A TRANSFER? — the third state a
                  transaction can be in, said in the same place and the same
                  shape as the other two, because a user checking "what is true
                  about this row" should find all of it in one column.

                  Read from the STORED row, never from the form: whether the
                  other side exists is a fact about what is saved, and a target
                  half-chosen in the dropdown above is not a link yet. Shown for
                  transfers and only transfers, so its absence on an ordinary
                  row says something rather than nothing.

                  Ticked and disabled like the statement line beside it: a link
                  is not made or broken from a checkbox. The way to the other
                  side is the "Jump to the other side" button in the Transfer To
                  field, which is the navigation and stays the navigation. */}
              {transaction?.type === 'transfer' && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!transaction.linkedTransferId}
                    disabled
                    className="rounded border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <ArrowRightLeftIcon size={16} className="text-blue-700 dark:text-blue-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {transaction.linkedTransferId
                      ? (otherSide?.accountName
                        ? `Linked transfer — the other side is in ${otherSide.accountName}`
                        : 'Linked transfer')
                      : 'Linked transfer — no other side recorded'}
                  </span>
                </label>
              )}

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
            {/* Low-key on purpose: a way out to context, not a competing
                action next to Save. Any unsaved edits are abandoned, same as
                Cancel, so it reads as leaving rather than committing. */}
            {ownAccountJump && (
              <button
                type="button"
                onClick={() => jumpToRegister(ownAccountJump.accountId, ownAccountJump.transactionId)}
                className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-secondary"
              >
                <ArrowUpRightIcon size={14} />
                {ownAccountJump.label}
              </button>
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

        {/* The register's delete confirmation, shared: role="alertdialog" so the
            consequence is announced on arrival, Delete focused so a keyboard
            answers it, Escape cancels, focus trapped between the two buttons
            and RETURNED on the way out. The editor's own inline version had
            none of that, and a delete reached through the editor is the same
            delete with the same stranding warning — it must not be answered on
            worse terms than one reached from the register.

            `isOpen` guards it as well as the flag: see the effect above, which
            explains why a closed editor must not leave a dialog behind. */}
        {isOpen && showDeleteConfirm && transaction && (
          <DeleteTransactionConfirm
            transaction={transaction}
            stranding={deleteStranding}
            onConfirm={() => { void handleDelete(); }}
            onConfirmBothSides={() => { void handleDeleteBothSides(); }}
            onCancel={() => setShowDeleteConfirm(false)}
          />
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

        {/* The one case a re-point stops to ask about: a counterpart that might
            be a real transaction rather than this app's own bookkeeping. */}
        {transaction && repointPrompt && (
          <TransferRepointDialog
            targetAccountName={
              accounts.find(a => a.id === repointPrompt.targetAccountId)?.name ?? 'the new account'
            }
            displacedAccountName={
              repointPrompt.counterpart
                ? accounts.find(a => a.id === repointPrompt.counterpart?.accountId)?.name
                : undefined
            }
            counterpart={repointPrompt.counterpart}
            reasons={repointPrompt.reasons}
            busy={transferBusy}
            onChoose={(disposition) => void completeRepoint(
              disposition,
              disposition === 'move'
                ? 'Transfer moved — the other side went with it.'
                : disposition === 'release'
                  ? 'Transfer moved — the old other side was left where it was, uncategorised.'
                  : 'Transfer moved — the old other side was deleted.'
            )}
            onCancel={() => {
              setRepointPrompt(null);
              advanceAfterRepointRef.current = null;
            }}
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
