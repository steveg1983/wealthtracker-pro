import { useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { PlusIcon } from '../components/icons';
import CategoryCreationModal from './CategoryCreationModal';
import { getCurrencySymbol } from '../utils/currency';
// Import { Modal, ModalBody, ModalFooter } from './common/Modal'; // Unused imports
import { ResponsiveModal } from './ResponsiveModal';
import MoneyInput from './common/MoneyInput';
import AccountSelector from './common/AccountSelector';
import DatePicker from './common/DatePicker';
import { useModalForm } from '../hooks/useModalForm';
import { useTransactionNotifications } from '../hooks/useTransactionNotifications';
import { parseMoneyInput } from '../utils/decimal';
import { transferCategoryIdFor } from '../utils/transferRepoint';
import { isTransferFiling } from '../utils/transferCoherence';
import MarkdownEditor from './MarkdownEditor';
import { ValidationService } from '../services/validationService';
import { z } from 'zod';
import { LoadingButton } from './loading/LoadingState';
import { useToast } from '../contexts/ToastContext';
import { createScopedLogger } from '../loggers/scopedLogger';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * The account the form opens on. Omit it (the app-wide add, from the header
   * or the mobile +) and the picker starts empty, exactly as it always has.
   *
   * The account register passes its own account, so a transaction started from
   * a register lands in the register the user is looking at rather than making
   * them name the account they are already inside. The field stays EDITABLE:
   * it is a starting point, not a lock — an account picked here still wins.
   *
   * ─ THE ONE CONSTRAINT ─────────────────────────────────────────────────────
   * Read once, when this component MOUNTS: useModalForm freezes its initial
   * state (see its useState initialiser), so changing this prop on an
   * already-mounted modal does nothing. Every call site therefore MOUNTS the
   * modal when it opens and unmounts it when it closes — `{open && <Add… />}`
   * — which is what Layout and the register both do, and which is also what
   * gives each add a clean form rather than the last one's leftovers.
   */
  initialAccountId?: string;
}


/**
 * A draft the form has already refused AND explained, at the field that caused
 * it. Thrown rather than returned so useModalForm keeps the modal open (a clean
 * return is its success signal); caught without adding a second message.
 */
class DraftRefused extends Error {}

interface FormData {
  description: string;
  amount: string;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  subCategory: string;
  accountId: string;
  date: string;
  notes: string;
}

export default function AddTransactionModal({ isOpen, onClose, initialAccountId }: AddTransactionModalProps): React.JSX.Element {
  const {
    accounts, categories, getSubCategories, getDetailCategories,
    // The two writes that turn one row into a linked pair, and undo it if the
    // second half cannot be made. See onSubmit.
    createTransferCounterpart, deleteTransaction,
  } = useApp();
  // Adds through the same path the edit modal uses, so the user's Large
  // Transaction Warnings actually fire. This is the main way a transaction
  // gets entered; adding via useApp directly skipped the alert entirely, which
  // is why the setting looked broken.
  const { addTransaction } = useTransactionNotifications();
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const { showSuccess, showError } = useToast();
  const logger = useMemo(() => createScopedLogger('AddTransactionModal'), []);
  
  const { formData, updateField, handleSubmit, isSubmitting } = useModalForm<FormData>(
    {
      description: '',
      amount: '',
      type: 'expense',
      category: '',
      subCategory: '',
      // Where the caller sent us, or nothing. See initialAccountId: this is
      // the one read of it, and it happens on mount.
      accountId: initialAccountId ?? '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    },
    {
      onSubmit: async (data) => {
        try {
          // Clear previous errors
          setValidationErrors({});

          const isTransfer = data.type === 'transfer';
          /**
           * ON A TRANSFER, `category` HOLDS THE TARGET ACCOUNT.
           *
           * The same convention the register's quick-add dock uses, so the two
           * add surfaces model a transfer the same way. What this form used to
           * do with the Transfer button is worth writing down, because it was
           * the worst version of the bug this batch is about: it wrote ONE row
           * typed 'transfer', with no target account, no counterpart and no
           * link — and signed it POSITIVE, so a transfer OUT read as money in.
           */
          const targetAccountId = isTransfer ? data.category : '';
          if (isTransfer) {
            if (!targetAccountId) {
              setValidationErrors({ category: 'Choose the account the money moved to.' });
              throw new DraftRefused();
            }
            if (targetAccountId === data.accountId) {
              setValidationErrors({
                category: 'A transfer needs two different accounts — pick the account the money went to.',
              });
              throw new DraftRefused();
            }
            // The counterpart is −amount with no conversion, so both accounts
            // must share a currency. Refused here rather than after the first
            // write, so a knowable failure never puts a row in the ledger.
            const from = accounts.find(a => a.id === data.accountId)?.currency;
            const to = accounts.find(a => a.id === targetAccountId)?.currency;
            if (from && to && from !== to) {
              setValidationErrors({
                category: `Transfers between accounts in different currencies aren’t supported yet (${from} and ${to}).`,
              });
              throw new DraftRefused();
            }
          }

          // Validate the transaction data
          const validatedData = ValidationService.validateTransaction({
            description: data.description,
            amount: data.amount,
            type: isTransfer ? 'expense' : data.type,
            // A transfer's real category is written by createTransferCounterpart
            // (the target account's own To/From), so nothing category-shaped is
            // validated here — this field is holding an account id.
            category: isTransfer ? '' : data.category,
            accountId: data.accountId,
            date: data.date,
            notes: data.notes || undefined,
          });

          // If validation passes, add the transaction
          // CRITICAL FIX: Ensure amount is negative for expenses
          const amount = parseMoneyInput(validatedData.amount) ?? 0;
          // A transfer LEAVES the account it is entered on, so it is signed like
          // an expense. It used to be signed like income.
          const finalAmount = data.type === 'income' ? Math.abs(amount) : -Math.abs(amount);

          // Awaited so a failed write lands in the catch below rather than
          // announcing success for a transaction that was never saved.
          const created = await addTransaction({
            description: validatedData.description,
            amount: finalAmount,
            type: data.type,
            // The target's own To/From category, from the one place the
            // crossover rule is written down. createTransferCounterpart re-files
            // both sides anyway; this matters only if it cannot run and the
            // rollback cannot either — the row left behind then at least names
            // the account it was meant to face.
            category: isTransfer
              ? transferCategoryIdFor(categories, targetAccountId, finalAmount)
              : validatedData.category,
            accountId: validatedData.accountId,
            transferAccountId: isTransfer ? targetAccountId : undefined,
            date: new Date(validatedData.date),
            notes: validatedData.notes,
          });

          // BOTH LEGS, LINKED — or neither. See the same passage in the
          // register's dock: two independent inserts are not a transfer, because
          // neither row carries linkedTransferId and nothing ties them together.
          if (isTransfer) {
            try {
              await createTransferCounterpart(created.id, targetAccountId);
            } catch (counterpartError) {
              await deleteTransaction(created.id);
              throw counterpartError;
            }
          }

          // Show success message
          showSuccess(isTransfer ? 'Transfer added — both sides recorded' : 'Transaction added successfully');
          onClose();
        } catch (error) {
          if (error instanceof DraftRefused) {
            // The reason is already printed at the field that caused it. Adding
            // a general message would say the same thing twice, in the wrong
            // place.
          } else if (error instanceof z.ZodError) {
            // Show validation errors in the form
            setValidationErrors(ValidationService.formatErrors(error));
            // Also show a toast for the first error
            const firstError = error.issues[0];
            showError(firstError.message);
          } else {
            // Show user-friendly error toast
            showError(error);
            logger.error('Failed to add transaction', error as Error);
            setValidationErrors({ general: 'Unable to save transaction. Please try again.' });
          }
          /**
           * RETHROWN, so the form STAYS OPEN with the draft still in it.
           *
           * useModalForm treats a clean return from onSubmit as success: it
           * resets the fields and closes the modal. Swallowing the error here
           * therefore did the opposite of what the message it had just printed
           * implied — the modal shut, the typing went with it, and the message
           * was set on a component that was already unmounting. A refusal has to
           * leave the user where they can act on it.
           */
          throw error;
        }
      },
      onClose: () => {
        setValidationErrors({});
        onClose();
      }
    }
  );


  return (
    <>
      <ResponsiveModal 
        isOpen={isOpen} 
        onClose={onClose} 
        title="Add Transaction" 
        size="md"
        mobileSnapPoints={[0.5, 0.9]}
        mobileInitialSnapPoint={1}
      >
        <form onSubmit={handleSubmit}>
          <div className="p-4 md:p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => updateField('type', 'income')}
                  className={`px-4 py-2 min-h-[44px] rounded-lg font-medium transition-colors ${
                    formData.type === 'income'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  aria-label="Select income transaction type"
                  aria-pressed={formData.type === 'income'}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => updateField('type', 'expense')}
                  className={`px-4 py-2 min-h-[44px] rounded-lg font-medium transition-colors ${
                    formData.type === 'expense'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  aria-label="Select expense transaction type"
                  aria-pressed={formData.type === 'expense'}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => updateField('type', 'transfer')}
                  className={`px-4 py-2 min-h-[44px] rounded-lg font-medium transition-colors ${
                    formData.type === 'transfer'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  aria-label="Select transfer transaction type"
                  aria-pressed={formData.type === 'transfer'}
                >
                  Transfer
                </button>
              </div>
            </div>

            <div>
              {/* A combobox is not a labelable element, so the accessible
                  name rides on the control itself — the same pattern every
                  category picker in the app already uses. */}
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Account
              </label>
              <AccountSelector
                accounts={accounts}
                selectedAccountId={formData.accountId}
                onAccountChange={(accountId) => updateField('accountId', accountId)}
                placeholder="Search or select account…"
                formatLabel={(account) => `${account.name} (${account.type})`}
                className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]"
                usePortal
                required
                ariaLabel="Select account for transaction"
              />
            </div>

            <div>
              <label htmlFor="description-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                id="description-input"
                type="text"
                value={formData.description}
                onChange={(e) => {
                  updateField('description', e.target.value);
                  if (validationErrors.description) {
                    setValidationErrors(prev => ({ ...prev, description: '' }));
                  }
                }}
                className={`w-full px-3 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 ${validationErrors.description ? 'border-red-500' : 'border-gray-300 dark:border-gray-500'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]`}
                placeholder="e.g., Grocery shopping"
                maxLength={500}
                required
                aria-label="Transaction description"
                aria-describedby={validationErrors.description ? "description-error" : undefined}
              />
              {validationErrors.description && (
                <p id="description-error" className="mt-1 text-sm text-red-500" role="alert">{validationErrors.description}</p>
              )}
            </div>

            <div>
              <label htmlFor="amount-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Amount {formData.accountId && (() => {
                  const selectedAccount = accounts.find(a => a.id === formData.accountId);
                  return selectedAccount ? `(${getCurrencySymbol(selectedAccount.currency)})` : '(£)';
                })()}
              </label>
              <MoneyInput
                id="amount-input"
                value={formData.amount}
                // The sign comes from the income/expense toggle, so the field
                // itself only ever holds a positive amount.
                onChange={(value) => {
                  updateField('amount', value);
                  if (validationErrors.amount) {
                    setValidationErrors(prev => ({ ...prev, amount: '' }));
                  }
                }}
                className={`w-full px-3 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 ${validationErrors.amount ? 'border-red-500' : 'border-gray-300 dark:border-gray-500'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]`}
                required
                aria-label="Transaction amount"
                aria-describedby={validationErrors.amount ? "amount-error" : undefined}
              />
              {validationErrors.amount && (
                <p id="amount-error" className="mt-1 text-sm text-red-500" role="alert">{validationErrors.amount}</p>
              )}
            </div>

            {/* Category Selection — or, on a transfer, the OTHER ACCOUNT.
                A transfer is not filed under a category: it is a movement
                between two accounts, and naming the second one is the whole of
                what the form needs to write both sides. The picker takes the
                category selects' place in the same slot, so choosing where the
                money went feels like choosing a category rather than like a
                different form. */}
            {formData.type === 'transfer' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  To Account
                </label>
                <AccountSelector
                  accounts={accounts}
                  // A transfer from an account to itself moves nothing and has
                  // no other side to create, so it is left out rather than
                  // offered and then refused.
                  excludeIds={formData.accountId ? [formData.accountId] : []}
                  selectedAccountId={formData.category}
                  onAccountChange={(accountId) => {
                    updateField('category', accountId);
                    if (validationErrors.category) {
                      setValidationErrors(prev => ({ ...prev, category: '' }));
                    }
                  }}
                  placeholder="Search or select the account the money moved to…"
                  formatLabel={(account) => `${account.name} (${account.type})`}
                  className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]"
                  usePortal
                  required
                  ariaLabel="Select the account to transfer to"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Both sides are recorded: the money leaves this account and arrives in that one.
                </p>
                {validationErrors.category && (
                  <p className="mt-1 text-sm text-red-500" role="alert">{validationErrors.category}</p>
                )}
              </div>
            ) : (
            <div className="space-y-3">
              {/* Sub-category */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="category-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Category
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(true)}
                    className="text-sm text-primary hover:text-secondary flex items-center gap-1 p-2 min-h-[44px]"
                  >
                    <PlusIcon size={14} />
                    Create new category
                  </button>
                </div>
                <select
                  id="category-select"
                  value={formData.subCategory}
                  onChange={(e) => {
                    updateField('subCategory', e.target.value);
                    updateField('category', ''); // Reset detail category
                  }}
                  className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]"
                  required
                  aria-label="Select transaction category"
                >
                  <option value="">Select category</option>
                  {getSubCategories(`type-${formData.type}`).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Detail category */}
              {formData.subCategory && (
                <div>
                  <label htmlFor="subcategory-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sub-category
                  </label>
                  <select
                    id="subcategory-select"
                    value={formData.category}
                    onChange={(e) => updateField('category', e.target.value)}
                    className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]"
                    required
                    aria-label="Select transaction sub-category"
                  >
                    <option value="">Select sub-category</option>
                    {getDetailCategories(formData.subCategory)
                      // A "To/From <account>" category is never a filing for a
                      // whole transaction — it is what the Transfer type above
                      // says properly, and only that route creates both sides.
                      // These selects walk children by parentId, so without this
                      // the Transfer tree's leaves are one re-parenting away
                      // from appearing in an expense list.
                      .filter(cat => !isTransferFiling(cat))
                      .map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                  </select>
                </div>
              )}
            </div>
            )}

            <div>
              <label htmlFor="date-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date
              </label>
              {/* dd/mm/yyyy everywhere — a native date input renders in the
                  browser's locale, not the app's. */}
              <DatePicker
                id="date-input"
                value={formData.date}
                onChange={(val) => updateField('date', val)}
                className="text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]"
                required
                aria-label="Transaction date"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes (Optional)
              </label>
              <MarkdownEditor
                value={formData.notes}
                onChange={(value) => {
                  // Limit notes length
                  if (value.length <= 1000) {
                    updateField('notes', value);
                  }
                }}
                placeholder="Add any additional notes or details..."
                maxHeight="150px"
                className="w-full"
              />
              {formData.notes.length > 900 && (
                <p className="mt-1 text-sm text-gray-500">
                  {1000 - formData.notes.length} characters remaining
                </p>
              )}
            </div>
            {validationErrors.general && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
                {validationErrors.general}
              </div>
            )}
          </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 md:p-6">
            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 justify-center px-4 py-2 min-h-[44px] text-sm sm:text-base border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <LoadingButton
                isLoading={isSubmitting}
                loadingText="Adding..."
                className="flex-1 px-4 py-2 min-h-[44px] text-sm sm:text-base bg-[#1a2332] text-white rounded-lg hover:bg-secondary disabled:opacity-50"
              >
                Add Transaction
              </LoadingButton>
            </div>
          </div>
        </form>
      </ResponsiveModal>

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
