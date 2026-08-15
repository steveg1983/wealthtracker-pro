import { useEffect } from 'react';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import DatePicker from './common/DatePicker';
import MoneyInput from './common/MoneyInput';
import { useModalForm } from '../hooks/useModalForm';
import { parseMoneyInput } from '../utils/decimal';
import type { Account as BaseAccount, AccountUpdate } from '../types';
import ToggleSwitch from './ui/ToggleSwitch';
import CardNumberGuidance from './CardNumberGuidance';
import GroupedAccountOptions from './common/GroupedAccountOptions';
import { accountCurrencyOptions, describeAccountCurrency } from '../constants/accountCurrencies';
import {
  BANK_ACCOUNT_NUMBER_LENGTH,
  CARD_NUMBER_LABEL,
  accountNumberForStorage,
  formatSortCode,
  isCardAccountType,
  nextAccountNumberValue
} from '../utils/accountNumberInput';

// Extend the base Account type with additional fields needed for settings
// (type comes from BaseAccount — the single canonical union).
interface Account extends BaseAccount {
  sortCode?: string;
  accountNumber?: string;
}

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onSave: (accountId: string, updates: AccountUpdate) => void | Promise<void>;
  /**
   * The other accounts in view, which is what the investment↔cash pairing
   * field offers to pair with. Omitted by callers that have no list to give;
   * the field then never appears, and no pairing is written either way.
   */
  accounts?: readonly BaseAccount[];
  /**
   * Does this account already hold recorded money? It decides one thing only:
   * whether CURRENCY may still be edited (see the field itself for why).
   *
   * Established by the caller with {@link accountHasHistory}, because the pages
   * that open this modal already hold the transactions and this modal holds
   * none. OMITTING IT LOCKS THE FIELD: a caller that cannot tell whether there
   * is history must not be the reason a user re-denominates their ledger, and
   * "read-only with an explanation" is a harmless answer for an empty account
   * while "editable" is a destructive one for a full account.
   */
  hasTransactions?: boolean;
}

interface FormData {
  name: string;
  type: Account['type'];
  currency: string;
  openingBalance: string;
  openingBalanceDate: string;
  sortCode: string;
  accountNumber: string;
  institution: string;
  notes: string;
  isActive: boolean;
  lowBalanceAlertEnabled: boolean;
  lowBalanceThreshold: string;
  /** Investment account this one's money sits inside; '' = not paired. */
  parentAccountId: string;
}

const NO_PARENT_ACCOUNT = '';

/** What the pairing field may offer this account, and whether it appears at all. */
interface PairingState {
  offered: boolean;
  options: BaseAccount[];
}

/**
 * Investment↔cash pairing, from the account being edited outwards.
 *
 * Pairing is ONE-DIRECTIONAL and ONE DEEP (the Microsoft Money model): a cash
 * account sits inside an investment account, and that is the whole shape. So
 * the field is offered only while this account is not itself an investment
 * account and nothing is already nested inside it, and the candidates exclude
 * any investment account that is itself paired — three guards that between them
 * make a grandparent, a self-parent and a cycle unrepresentable from the UI.
 *
 * `selectedType` is the type CURRENTLY CHOSEN in the form, not the stored one:
 * switching an account to Investments takes the field away with it, exactly as
 * switching to Credit Card takes the sort code away.
 *
 * The account's existing parent is always among the candidates, even if it
 * would no longer qualify. A select whose value is missing from its own option
 * list silently shows something else, and saving that would re-parent the
 * account to whatever happened to be first.
 */
function resolvePairing(
  account: BaseAccount,
  accounts: readonly BaseAccount[],
  selectedType: BaseAccount['type']
): PairingState {
  const hasChildren = accounts.some(a => a.parentAccountId === account.id);
  const options = accounts.filter(a =>
    a.type === 'investment' &&
    a.id !== account.id &&
    a.isActive !== false &&
    !a.parentAccountId
  );
  const current = account.parentAccountId
    ? accounts.find(a => a.id === account.parentAccountId)
    : undefined;
  if (current && !options.some(a => a.id === current.id)) {
    options.push(current);
  }
  return {
    offered: selectedType !== 'investment' && !hasChildren && options.length > 0,
    options
  };
}

const accountTypeOptions = [
  { value: 'current', label: 'Current Account' },
  { value: 'savings', label: 'Savings Account' },
  { value: 'loan', label: 'Loan Account' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'investment', label: 'Investments' },
  { value: 'assets', label: 'Other Asset' },
  { value: 'other', label: 'Other Liability' }
];

export default function AccountSettingsModal({
  isOpen,
  onClose,
  account,
  onSave,
  accounts = [],
  hasTransactions
}: AccountSettingsModalProps) {
  /**
   * Editable only on an account with NO history, and only when the caller said
   * so out loud — `undefined` means "could not establish it", which locks.
   */
  const currencyEditable = hasTransactions === false;

  const { formData, updateField, handleSubmit, setFormData, errors, isSubmitting } = useModalForm<FormData>(
    {
      name: '',
      type: 'current',
      // Matches mapAccountFromDb's fallback and the accounts.currency column
      // default; overwritten from the account itself before anything renders.
      currency: 'GBP',
      openingBalance: '',
      openingBalanceDate: '',
      sortCode: '',
      accountNumber: '',
      institution: '',
      notes: '',
      isActive: true,
      lowBalanceAlertEnabled: false,
      lowBalanceThreshold: '',
      parentAccountId: NO_PARENT_ACCOUNT
    },
    {
      onSubmit: async (data) => {
        if (!account) return;

        const updates: AccountUpdate = {
          type: data.type,
          institution: data.institution || undefined,
          // Display name only — bank-feed links key on connection/account ids
          // (external_account_name is stored separately), so renaming is safe.
          // Never blank a name: an empty field leaves the current name as-is.
          ...(data.name.trim() !== '' ? { name: data.name.trim() } : {}),
          notes: data.notes || undefined,
          // A card has no sort code (see utils/accountNumberInput). The input is
          // hidden for cards, so switching an account to Credit Card leaves the
          // loaded value sitting in form state — send an explicit null to clear
          // the stored one instead of writing it back. undefined would not do
          // it: mapAccountToDb skips undefined fields, leaving the stale sort
          // code in place, where findSmartMatch would still match on it.
          sortCode: isCardAccountType(data.type) ? null : data.sortCode || undefined,
          // A card stores its last 4 digits and nothing else, whatever the
          // field was left holding — the trim happens here rather than while
          // typing so a pasted number loses its FIRST twelve, not its last four.
          accountNumber: accountNumberForStorage(data.accountNumber, isCardAccountType(data.type)),
          isActive: data.isActive,
          lowBalanceAlertEnabled: data.lowBalanceAlertEnabled,
          lowBalanceThreshold: data.lowBalanceThreshold ? parseMoneyInput(data.lowBalanceThreshold) ?? undefined : undefined,
          // Only ever written when the field was on screen: a modal opened
          // without an account list, or on an account the pairing rules rule
          // out, must not silently unpair anything. null (not undefined)
          // clears it — mapAccountToDb drops undefined fields.
          ...(resolvePairing(account, accounts, data.type).offered
            ? { parentAccountId: data.parentAccountId || null }
            : {}),
          // Same rule, and for a much sharper reason: only ever written when
          // the field was EDITABLE. On an account with history the value on
          // screen is the stored one, so writing it back would be a no-op —
          // right up until the account gains its first transaction between the
          // modal opening and Save, when it would silently re-denominate a
          // ledger that had just stopped being empty.
          ...(currencyEditable && data.currency ? { currency: data.currency } : {})
        };

        if (data.openingBalance !== '') {
          updates.openingBalance = parseMoneyInput(data.openingBalance) ?? 0;
        }
        if (data.openingBalanceDate) {
          updates.openingBalanceDate = new Date(data.openingBalanceDate);
        }

        await onSave(account.id, updates);
      },
      onClose
    }
  );

  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name || '',
        type: account.type || 'current',
        currency: account.currency || 'GBP',
        openingBalance: account.openingBalance != null ? account.openingBalance.toFixed(2) : '',
        /*
         * BLANK WHEN THERE IS NO DATE. It used to pre-fill TODAY, and that was
         * not a default — it was a fabrication with a save button under it.
         *
         * Most imported accounts have no opening date, correctly: Money records
         * `dtOpen` only sometimes, and our importer writes `undefined` rather
         * than inventing one (import/msMoney/transform.ts). The app then applies
         * the opening balance from the account's FIRST TRANSACTION
         * (utils/openingDates, rung 2) and the net-worth report says so out loud
         * — "5 accounts' opening dates are inferred from their first activity".
         *
         * With today's date pre-filled, opening this dialog to change an
         * account's NAME and pressing Save stamped that inference into a stored
         * fact of the wrong day. The owner found it on an account imported days
         * earlier that claimed to have opened this morning. For an account with
         * transactions the damage is bounded — rung 1 clamps a stored date back
         * to the first transaction — but an account with no transactions has
         * nothing to clamp against, and its opening balance would land on
         * whichever day the dialog happened to be opened.
         *
         * Blank is the honest representation of "not set", and the note under
         * the field says what blank does.
         */
        openingBalanceDate: account.openingBalanceDate
          ? new Date(account.openingBalanceDate).toISOString().split('T')[0]
          : '',
        sortCode: account.sortCode || '',
        accountNumber: account.accountNumber || '',
        institution: account.institution || '',
        notes: account.notes || '',
        isActive: account.isActive !== false,
        lowBalanceAlertEnabled: account.lowBalanceAlertEnabled ?? false,
        lowBalanceThreshold: account.lowBalanceThreshold != null ? account.lowBalanceThreshold.toString() : '',
        parentAccountId: account.parentAccountId ?? NO_PARENT_ACCOUNT
      });
    }
  }, [account, setFormData]);


  const handleSortCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateField('sortCode', formatSortCode(e.target.value));
  };

  // A card has no sort code and no 8-digit account number — the bank feed
  // identifies it by the last 4 digits alone (see findCardMaskMatch in
  // LinkBankAccountsModal). So the same stored field means "last 4" here and
  // "full account number" for a current/savings account, and the form has to
  // say which it is: without a hint, "Account Number" invites the whole 16
  // digits, which would then live in the user's backups, JSON export and
  // audit history for no benefit at all. The rules and the wording are shared
  // with AddAccountModal, which asks for the same details at creation.
  const isCreditCard = isCardAccountType(formData.type);
  const isBankAccount = formData.type === 'current' || formData.type === 'savings';

  const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateField('accountNumber', nextAccountNumberValue(e.target.value, isCreditCard));
  };

  if (!account) return null;

  // A closed account reaches this modal from the Closed Accounts list, and
  // everything here works on it: the fields load from the account itself and
  // the save is a plain row update that carries the account's own status back
  // (so editing a closed account never quietly reopens it).
  const isClosedAccount = account.isActive === false;
  const pairing = resolvePairing(account, accounts, formData.type);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Account Settings" size="md">
      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          {isClosedAccount && (
            <p className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
              This account is closed. Its details can be edited from here and it
              stays closed; its transactions are only reachable once you set
              Account Status back to Open.
            </p>
          )}

          {/* Account Name */}
          <div>
            <label htmlFor="account-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Account Name
            </label>
            <input
              id="account-name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:border-transparent dark:text-white"
              aria-label="Account name"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Display name only — renaming never affects bank feed links, which
              are matched on the bank's own account identifiers
            </p>
          </div>

          {/* Account Type */}
          <div>
            <label htmlFor="account-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Account Type
            </label>
            <select
              id="account-type"
              value={formData.type}
              onChange={(e) => updateField('type', e.target.value as Account['type'])}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:border-transparent dark:text-white"
            >
              {accountTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Changing the type will relocate this account to the appropriate section
            </p>
          </div>

          {/* Currency — always shown, editable only while the account is empty.
              An account's currency was chosen once in AddAccountModal and then
              never displayed again anywhere, so the one figure that says what
              every other figure MEANS was invisible. */}
          <div>
            {currencyEditable ? (
              <>
                <label htmlFor="account-currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Currency
                </label>
                <select
                  id="account-currency"
                  value={formData.currency}
                  onChange={(e) => updateField('currency', e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:border-transparent dark:text-white"
                >
                  {/* The account's own code is always among these, even if the
                      app does not support it — see accountCurrencyOptions. */}
                  {accountCurrencyOptions(formData.currency).map(option => (
                    <option key={option.value} value={option.value}>
                      {option.symbol} {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Nothing has been recorded in this account yet, so its currency
                  can still be changed. It is fixed as soon as the first
                  transaction lands here.
                </p>
              </>
            ) : (
              <>
                {/* Not a disabled <select>: there is no control here to reach,
                    and a greyed-out dropdown says "unavailable" where the
                    account needs to say "settled". */}
                <span id="account-currency-label" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Currency
                </span>
                <p
                  aria-labelledby="account-currency-label"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-700 dark:text-gray-200"
                >
                  {describeAccountCurrency(formData.currency)}
                </p>
                {/* The consequence, not the rule: changing the denomination
                    would leave every stored figure at its own number while
                    changing what that number means — the same re-labelling
                    Microsoft Money refuses once an account has a register. */}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  This account already has transactions, so its currency is
                  fixed — changing it now would leave every recorded figure at
                  the same number while quietly re-labelling what that number
                  is worth.
                </p>
              </>
            )}
          </div>

          {/* Opening Balance */}
          <div>
            <label htmlFor="opening-balance" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Opening Balance
            </label>
            <div className="space-y-2">
              <MoneyInput
                id="opening-balance"
                // Credit cards and loans open in the red, so the sign stays.
                allowNegative
                value={formData.openingBalance}
                onChange={(value) => updateField('openingBalance', value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:border-transparent dark:text-white"
                aria-label="Opening balance amount"
              />
              <DatePicker
                id="opening-balance-date"
                value={formData.openingBalanceDate}
                onChange={(val) => updateField('openingBalanceDate', val)}
                className="bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:border-transparent dark:text-white"
                aria-label="Opening balance date"
              />
              {/* Says what BLANK does, because blank is now the normal state for
                  an imported account and an unexplained empty date field reads
                  as something missing rather than something inferred. */}
              {formData.openingBalanceDate === '' && (
                <p className="text-label text-gray-500 dark:text-gray-400">
                  Left blank, the opening balance applies from this account's first
                  transaction. Set a date only if the account opened earlier.
                </p>
              )}
            </div>
          </div>

          {/* Bank Details */}
          {isBankAccount && (
            <div>
              <label htmlFor="sort-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sort Code
              </label>
              <input
                id="sort-code"
                type="text"
                value={formData.sortCode}
                onChange={handleSortCodeChange}
                placeholder="XX-XX-XX"
                maxLength={8}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:border-transparent dark:text-white"
                aria-label="Bank sort code"
              />
            </div>
          )}

          {(isBankAccount || isCreditCard) && (
            <div>
              <label htmlFor="account-number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {isCreditCard ? CARD_NUMBER_LABEL : 'Account Number'}
              </label>
              <input
                id="account-number"
                type="text"
                inputMode="numeric"
                // A reference number, not a word.
                spellCheck={false}
                autoCapitalize="none"
                value={formData.accountNumber}
                onChange={handleAccountNumberChange}
                placeholder={isCreditCard ? '1234' : '12345678'}
                // See AddAccountModal: an aria-label here would override the
                // visible card label with wording that does not contain it
                // (WCAG 2.5.3 Label in Name).
                aria-label={isCreditCard ? undefined : 'Bank account number'}
                {...(isBankAccount ? { maxLength: BANK_ACCOUNT_NUMBER_LENGTH } : {})}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:border-transparent dark:text-white"
              />
              {isCreditCard && <CardNumberGuidance value={formData.accountNumber} />}
            </div>
          )}

          {/* Investment↔cash pairing */}
          {pairing.offered && (
            <div>
              <label htmlFor="account-parent" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Part of investment account
              </label>
              <select
                id="account-parent"
                value={formData.parentAccountId}
                onChange={(e) => updateField('parentAccountId', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:border-transparent dark:text-white"
              >
                <option value={NO_PARENT_ACCOUNT}>None</option>
                {/* Grouped and alphabetised like every other account dropdown. */}
                <GroupedAccountOptions accounts={pairing.options} />
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                For the cash held alongside an investment account. This account
                keeps its own register and transactions; it moves inside that
                account on the Accounts page, and its balance counts towards
                that investment's value.
              </p>
            </div>
          )}

          {/* Institution */}
          <div>
            <label htmlFor="account-institution" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Institution
            </label>
            <input
              id="account-institution"
              type="text"
              value={formData.institution}
              onChange={(e) => updateField('institution', e.target.value)}
              placeholder="Bank or financial institution name"
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:border-transparent dark:text-white"
            />
          </div>

          {/* Account Status */}
          <div>
            <label htmlFor="account-active" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Account Status
            </label>
            <select
              id="account-active"
              value={formData.isActive ? 'active' : 'closed'}
              onChange={(e) => updateField('isActive', e.target.value === 'active')}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:border-transparent dark:text-white"
            >
              <option value="active">Open</option>
              <option value="closed">Closed</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Closed accounts move to the Closed Accounts section — history is
              preserved, the account's transfer category is hidden from
              transaction dropdowns, and you can reopen it at any time.
            </p>
          </div>

          {/* Low Balance Alert */}
          <div>
            <div className="flex items-center justify-between mb-2">
              {/* Not a <label>: the control is a switch button, named via aria-labelledby */}
              <span id="low-balance-alert-label" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Low Balance Alert
              </span>
              <ToggleSwitch
                checked={!!formData.lowBalanceAlertEnabled}
                onChange={v => updateField('lowBalanceAlertEnabled', v)}
                // The only setting here that a closed account cannot honour:
                // low-balance alerts are raised from the live accounts list,
                // which a closed account has left. Say so rather than let the
                // user arm an alert that can never fire.
                disabled={!formData.isActive}
                aria-labelledby="low-balance-alert-label"
              />
            </div>
            {!formData.isActive && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Low balance alerts only run on open accounts.
              </p>
            )}
            {formData.isActive && formData.lowBalanceAlertEnabled && (
              <div className="mt-1">
                <label htmlFor="low-balance-threshold" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Alert when balance falls below
                </label>
                <MoneyInput
                  id="low-balance-threshold"
                  value={formData.lowBalanceThreshold}
                  onChange={(value) => updateField('lowBalanceThreshold', value)}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:border-transparent dark:text-white"
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="account-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              id="account-notes"
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={3}
              placeholder="Additional information about this account"
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:border-transparent dark:text-white resize-none"
            />
          </div>

        </ModalBody>
        <ModalFooter>
          {errors?.submit && (
            <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{errors.submit}</p>
            </div>
          )}
          <div className="flex gap-3 w-full">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 justify-center bg-[#1a2332] text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 justify-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}