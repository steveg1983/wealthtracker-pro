import { useEffect, useMemo, useState } from 'react';
import DatePicker from './common/DatePicker';
import { useApp } from '../contexts/AppContextSupabase';
import { usePreferences } from '../contexts/PreferencesContext';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import MoneyInput from './common/MoneyInput';
import { Building2Icon, WalletIcon, CreditCardIcon, TrendingUpIcon, PiggyBankIcon, BanknoteIcon, PackageIcon, AlertCircleIcon } from './icons';
import type { Account } from '../types';
import { createScopedLogger } from '../loggers/scopedLogger';
import { parseMoneyInput } from '../utils/decimal';
import CardNumberGuidance from './CardNumberGuidance';
import { ACCOUNT_CURRENCIES } from '../constants/accountCurrencies';
import {
  BANK_ACCOUNT_NUMBER_LENGTH,
  CARD_NUMBER_LABEL,
  accountNumberForStorage,
  formatSortCode,
  isCardAccountType,
  nextAccountNumberValue
} from '../utils/accountNumberInput';

interface AccountPrefill {
  name?: string;
  type?: AccountFormData['type'];
  balance?: string;
  currency?: string;
  institution?: string;
  sortCode?: string;
  accountNumber?: string;
}

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefill?: AccountPrefill;
  onAccountCreated?: (accountId: string) => void;
}

interface AccountFormData {
  name: string;
  type: 'current' | 'checking' | 'savings' | 'credit' | 'loan' | 'investment' | 'assets' | 'other';
  balance: string;
  currency: string;
  institution: string;
  sortCode: string;
  accountNumber: string;
  /** yyyy-mm-dd, the date the opening balance was true. */
  openingBalanceDate: string;
}

const accountTypes = [
  { value: 'current', label: 'Current Account', icon: WalletIcon, description: 'Everyday spending account' },
  { value: 'savings', label: 'Savings Account', icon: PiggyBankIcon, description: 'Long-term savings' },
  { value: 'credit', label: 'Credit Card', icon: CreditCardIcon, description: 'Credit line account' },
  { value: 'loan', label: 'Loan', icon: BanknoteIcon, description: 'Mortgages, personal loans' },
  { value: 'investment', label: 'Investment', icon: TrendingUpIcon, description: 'Stocks, bonds, funds' },
  { value: 'assets', label: 'Asset', icon: PackageIcon, description: 'Property, valuables' },
  // There was NO way to create a liability here, so anything that was not a
  // loan or a card had to be made as something else and retyped afterwards —
  // and Account Settings then offered only "Other Liability", which filed it
  // under Other Accounts rather than Liabilities.
  { value: 'liability', label: 'Liability', icon: BanknoteIcon, description: 'Anything else you owe' },
];

// The supported list, shared with Account Settings — which now SHOWS an
// account's currency, and must offer exactly what this form offered when the
// account was made. See constants/accountCurrencies.
const currencies = ACCOUNT_CURRENCIES;

/** Today as yyyy-mm-dd, which is what a date input speaks. */
const todayForInput = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

export default function AddAccountModal({ isOpen, onClose, prefill, onAccountCreated }: AddAccountModalProps): React.JSX.Element {
  const { addAccount } = useApp();
  const { currency: defaultCurrency } = usePreferences();
  const logger = useMemo(() => createScopedLogger('AddAccountModal'), []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * ONE TICK INSTEAD OF CREATE-THEN-LINK (owner, 30 Aug): an investment
   * account usually has cash alongside its holdings, and pairing one up used
   * to take a second trip through this modal plus Account Settings → Part of
   * investment account. Ticked, the submit creates BOTH — the cash account
   * carries the same details with ' (Cash)' on the name, is itself an
   * investment-type account, and is born already paired (parentAccountId).
   * After that it is an ordinary account: its own register, its own
   * settings, deletable like any other.
   */
  const [withCashRegister, setWithCashRegister] = useState(false);
  const [cashBalance, setCashBalance] = useState('');
  const [formData, setFormData] = useState<AccountFormData>({
    name: '',
    type: 'current',
    balance: '',
    currency: defaultCurrency,
    institution: '',
    sortCode: '',
    accountNumber: '',
    openingBalanceDate: todayForInput()
  });

  // Reset form when modal opens (seed from prefill if provided)
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: prefill?.name ?? '',
        type: prefill?.type ?? 'current',
        balance: prefill?.balance ?? '',
        currency: prefill?.currency ?? defaultCurrency,
        institution: prefill?.institution ?? '',
        sortCode: prefill?.sortCode ? formatSortCode(prefill.sortCode) : '',
        accountNumber: prefill?.accountNumber ?? '',
        openingBalanceDate: todayForInput(),
      });
      setError(null);
      setIsSubmitting(false);
      setWithCashRegister(false);
      setCashBalance('');
    }
  }, [isOpen, defaultCurrency, prefill]);

  const updateField = <K extends keyof AccountFormData>(field: K, value: AccountFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return; // Prevent double submission
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      logger.info?.('[AddAccountModal] Submitting account:', formData);
      
      // Validate the form data
      if (!formData.name.trim()) {
        throw new Error('Account name is required');
      }
      
      // BLANK MEANS ZERO, which is what a new account opened today holds.
      // The field stopped being `required` with this (Claude Design, 15 Aug);
      // without this line the two disagreed and an empty box was refused by
      // the validator instead of the browser — the same dead end one layer
      // down. Something TYPED that will not parse is still an error: "abc" is
      // a mistake, and empty is an answer.
      const balance = formData.balance.trim() === ''
        ? 0
        : parseMoneyInput(formData.balance) ?? NaN;
      if (isNaN(balance)) {
        throw new Error('Please enter a valid balance');
      }
      
      // Strip formatting from sort code for storage (XX-XX-XX → XXXXXX).
      // A credit card has no sort code, so anything typed before the type was
      // switched to Credit Card is not part of what is being created.
      const isCard = isCardAccountType(formData.type);
      const rawSortCode = isCard ? '' : formData.sortCode.replace(/\D/g, '');

      const newAccountPayload: Omit<Account, 'id'> & { initialBalance?: number } = {
        name: formData.name.trim(),
        type: formData.type,
        balance,
        initialBalance: balance,
        currency: formData.currency,
        institution: formData.institution.trim() || undefined,
        lastUpdated: new Date(),
        openingBalance: balance,
        // The date the user gave, not the moment the row was written.
        openingBalanceDate: formData.openingBalanceDate
          ? new Date(formData.openingBalanceDate)
          : new Date(),
        isActive: true,
        sortCode: rawSortCode || undefined,
        // A card is created holding its last 4 digits and nothing else — the
        // field itself is uncapped so a pasted number keeps the RIGHT four
        // (see nextAccountNumberValue), and this is where the rest is dropped.
        accountNumber: accountNumberForStorage(formData.accountNumber, isCard),
      };

      const wantsCashRegister = formData.type === 'investment' && withCashRegister;
      const parsedCashBalance = cashBalance.trim() === ''
        ? 0
        : parseMoneyInput(cashBalance) ?? NaN;
      if (wantsCashRegister && isNaN(parsedCashBalance)) {
        throw new Error('Please enter a valid opening balance for the cash account');
      }

      // Create the account
      const result = await addAccount(newAccountPayload);

      logger.info?.('[AddAccountModal] Account added successfully:', result);

      // The ticked cash register: same details, ' (Cash)' on the name, born
      // paired to the account just created. Failure here must say what DID
      // happen — the investment account exists — and hand over the manual
      // path rather than inviting a retry that would duplicate it.
      if (wantsCashRegister && result?.id) {
        try {
          await addAccount({
            name: `${newAccountPayload.name} (Cash)`,
            type: 'investment',
            balance: parsedCashBalance,
            initialBalance: parsedCashBalance,
            currency: newAccountPayload.currency,
            institution: newAccountPayload.institution,
            lastUpdated: new Date(),
            openingBalance: parsedCashBalance,
            openingBalanceDate: newAccountPayload.openingBalanceDate,
            isActive: true,
            parentAccountId: result.id,
          });
        } catch (cashError) {
          throw new Error(
            `${newAccountPayload.name} was created, but its cash account could not be` +
            `${cashError instanceof Error ? ` (${cashError.message})` : ''}. ` +
            'Add it yourself: a new investment-type account, paired in Account Settings → Part of investment account.'
          );
        }
      }

      // Reset form and close modal only after successful creation
      setFormData({
        name: '',
        type: 'current',
        balance: '',
        currency: formData.currency, // Keep the same currency
        institution: '',
        sortCode: '',
        accountNumber: '',
        // Back to today, not to whatever the last account used: the next
        // account is a different account.
        openingBalanceDate: todayForInput(),
      });
      setIsSubmitting(false);

      // Notify parent of newly created account (for linking flow)
      if (onAccountCreated && result?.id) {
        onAccountCreated(result.id);
      }

      // Small delay to ensure state updates are processed
      setTimeout(() => {
        onClose();
      }, 100);
      
    } catch (error) {
      logger.error('[AddAccountModal] Failed to add account', error as Error);
      setError(error instanceof Error ? error.message : 'Failed to add account. Please try again.');
      setIsSubmitting(false); // Only reset on error, not on success
    }
  };

  const selectedCurrency = currencies.find(c => c.value === formData.currency);
  const isCreditCard = isCardAccountType(formData.type);
  const isBankAccount = formData.type === 'current' || formData.type === 'savings';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Account" size="lg">
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                <div className="flex gap-3">
                  <AlertCircleIcon size={20} className="text-red-600 dark:text-red-400 mt-0.5" />
                  <div className="text-sm text-red-700 dark:text-red-300">
                    {error}
                  </div>
                </div>
              </div>
            )}

            {/* Account Name */}
            <div>
              <label htmlFor="add-account-name" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Account name
              </label>
              <input
                id="add-account-name"
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-primary dark:text-white transition-all duration-200"
                placeholder="e.g., Main Checking Account"
                required
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            {/* Account Type */}
            <div>
              {/* Not a <label>: the control is a group of buttons, not a single input */}
              <span id="add-account-type-label" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Account type
              </span>
              <div role="group" aria-labelledby="add-account-type-label" className="grid grid-cols-2 gap-3">
                {accountTypes.map((type) => {
                  const Icon = type.icon;
                  const isSelected = formData.type === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => updateField('type', type.value as AccountFormData['type'])}
                      disabled={isSubmitting}
                      // Selection is otherwise conveyed by colour alone.
                      aria-pressed={isSelected}
                      className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                        isSelected
                          // The FILL, which was `dark:bg-[#1a2332]/20` — navy at
                          // a fifth, on a gray-800 modal. Under a ring that was
                          // itself navy (see index.css), a selected tile in dark
                          // mode looked exactly like an unselected one, which is
                          // what Claude Design read as "no type is chosen".
                          ? 'border-primary bg-[#1a2332]/10 dark:bg-gray-700'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon 
                          size={20} 
                          className={isSelected ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}
                        />
                        <div className="text-left flex-1">
                          <div className={`text-sm font-medium ${
                            isSelected ? 'text-primary' : 'text-gray-700 dark:text-gray-200'
                          }`}>
                            {type.label}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {type.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Balance and Currency Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Current Balance */}
              <div>
                <label htmlFor="add-account-balance" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Opening balance
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">
                    {selectedCurrency?.symbol}
                  </span>
                  <MoneyInput
                    id="add-account-balance"
                    // Credit cards and loans start negative.
                    allowNegative
                    value={formData.balance}
                    onChange={(value) => updateField('balance', value)}
                    className="w-full pl-8 pr-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-primary dark:text-white transition-all duration-200"
                    // NOT required (Claude Design, 15 August). An account opened
                    // today with nothing in it has a balance of £0.00, and
                    // marking this required made a person type a zero to satisfy
                    // a validator. The placeholder already showed 0.00; blank
                    // now means what it looks like it means.
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Currency */}
              <div>
                <label htmlFor="add-account-currency" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Currency
                </label>
                <select
                  id="add-account-currency"
                  value={formData.currency}
                  onChange={(e) => updateField('currency', e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-primary dark:text-white transition-all duration-200 appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                >
                  {currencies.map(curr => (
                    <option key={curr.value} value={curr.value}>
                      {curr.symbol} {curr.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* An investment account usually has cash beside its holdings —
                one tick creates and pairs it (owner, 30 Aug). Only offered
                for the type it makes sense for; the box resets with the
                form. */}
            {formData.type === 'investment' && (
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={withCashRegister}
                    onChange={(e) => setWithCashRegister(e.target.checked)}
                    disabled={isSubmitting}
                    className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                      Add a cash register to this investment
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      Creates a second account alongside this one — same details, &lsquo;(Cash)&rsquo;
                      on the name — already paired to it, for the money that sits uninvested.
                    </span>
                  </span>
                </label>
                {withCashRegister && (
                  <div>
                    <label htmlFor="add-account-cash-balance" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                      Opening balance — cash account
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">
                        {selectedCurrency?.symbol}
                      </span>
                      <MoneyInput
                        id="add-account-cash-balance"
                        value={cashBalance}
                        onChange={setCashBalance}
                        className="w-full pl-8 pr-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-primary dark:text-white transition-all duration-200"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Institution */}
            <div>
              <label htmlFor="add-account-institution" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Financial Institution
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">(Optional)</span>
              </label>
              <div className="relative">
                <Building2Icon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="add-account-institution"
                  type="text"
                  value={formData.institution}
                  onChange={(e) => updateField('institution', e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-primary dark:text-white transition-all duration-200"
                  placeholder="e.g., Barclays, HSBC, NatWest"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* ─ WHEN THE OPENING BALANCE APPLIES ────────────────────────────
                This was written silently as `new Date()` and never shown, so
                every account's opening balance was dated the day it was created
                whether or not that was true.

                It matters because the register builds its running balance
                FORWARD from this figure (AccountTransactions.tsx). Add an
                account, type what the bank says today, then import a year of
                history into it, and the year lands ON TOP of a figure that
                already included it.

                Today is still the default — it is right for an account you are
                starting fresh — but it is now a default rather than a fact,
                and somebody importing history can set it to before their
                earliest transaction, which is what makes the running balance
                mean anything. */}
            <div>
              <label htmlFor="add-account-opening-date" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Opening balance as of
              </label>
              <DatePicker
                id="add-account-opening-date"
                value={formData.openingBalanceDate}
                onChange={(value) => updateField('openingBalanceDate', value)}
                aria-label="Opening balance as of"
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-primary dark:text-white transition-all duration-200"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                The date that balance was true. If you are about to import older
                transactions, set this to before the earliest of them.
              </p>
            </div>

            {/* Bank details: sort code + account number for a UK bank account,
                the card's last 4 digits for a credit card. A card has no sort
                code, and its digits are what links it to a bank feed — asking
                for them here saves creating the card and then having to reopen
                it in Account Settings to add them. */}
            {(isBankAccount || isCreditCard) && (
              <div className={isBankAccount ? 'grid grid-cols-2 gap-4' : undefined}>
                {isBankAccount && (
                  <div>
                    <label htmlFor="add-account-sort-code" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                      Sort Code
                      <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">(Optional)</span>
                    </label>
                    <input
                      id="add-account-sort-code"
                      type="text"
                      value={formData.sortCode}
                      onChange={(e) => updateField('sortCode', formatSortCode(e.target.value))}
                      className="w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-primary dark:text-white transition-all duration-200"
                      placeholder="XX-XX-XX"
                      maxLength={8}
                      aria-label="Bank sort code"
                      disabled={isSubmitting}
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="add-account-number" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    {isCreditCard ? CARD_NUMBER_LABEL : 'Account Number'}
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">(Optional)</span>
                  </label>
                  <input
                    id="add-account-number"
                    type="text"
                    inputMode="numeric"
                    // A reference number, not a word.
                    spellCheck={false}
                    autoCapitalize="none"
                    value={formData.accountNumber}
                    onChange={(e) => updateField('accountNumber', nextAccountNumberValue(e.target.value, isCreditCard))}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-primary dark:text-white transition-all duration-200"
                    placeholder={isCreditCard ? '1234' : '12345678'}
                    // No aria-label for a card: it would override the visible
                    // "Card Number — last 4 digits only" with wording that does
                    // not contain it, so speaking the visible label would not
                    // reach the field (WCAG 2.5.3 Label in Name).
                    aria-label={isCreditCard ? undefined : 'Bank account number'}
                    {...(isBankAccount ? { maxLength: BANK_ACCOUNT_NUMBER_LENGTH } : {})}
                    disabled={isSubmitting}
                  />
                  {isCreditCard && <CardNumberGuidance value={formData.accountNumber} />}
                </div>
              </div>
            )}

            {/* The "Account Type Info Banner" was here: an icon, the type's
                name and its description, repeated verbatim from the tile that
                is ringed six inches above it. Claude Design, 15 August — it was
                the THIRD statement of one fact, carried no label saying what it
                was, and a reader had to work out it was a confirmation rather
                than another control. Dropped rather than relabelled: the modal
                is not tall enough for the tiles to scroll out of view, so it
                was not keeping the choice visible either. */}
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 justify-center px-6 py-3 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              /* The dark treatment is not decoration. `from-primary to-secondary`
                 is #1a2332 → #2d3a4d, and on a gray-800 modal that is navy on
                 navy: the button reads as MUTED. Claude Design saw it in four
                 dark captures and reported the primary action as "a dead end …
                 a disabled primary and no route forward". It was never
                 disabled — `disabled={isSubmitting}` is the whole of it — it
                 just could not be seen to be enabled. Third instance of one
                 root cause on this modal; see index.css's .dark .border-primary. */
              className="flex-1 justify-center px-6 py-3 bg-gradient-to-r from-primary to-secondary dark:from-gray-600 dark:to-gray-500 text-white rounded-xl hover:shadow-lg hover:scale-[1.02] font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting ? 'Adding...' : 'Add Account'}
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
