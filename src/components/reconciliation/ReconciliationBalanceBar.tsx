import React, { useState, useEffect, useRef } from 'react';
import { parseMoneyInput, toDecimal } from '../../utils/decimal';
import MoneyInput from '../common/MoneyInput';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { ClearedSummary } from '../../hooks/useReconciliation';

interface ReconciliationBalanceBarProps {
  bankBalance: number | null;
  accountBalance: number;
  clearedBalance: number;
  currency?: string;
  clearedSummary?: ClearedSummary;
  /**
   * `null` means "there is no bank balance" — the state the account was in
   * before anyone typed one, and the only honest state when the recorded
   * figure was wrong or was written by an import. Without it a balance could
   * be overwritten but never withdrawn, so an account that has no statement
   * figure to compare against was stuck asserting a stale one forever.
   */
  onBankBalanceChange?: (newBalance: number | null) => void;
}

/** What removing the figure costs, said in full wherever it is offered. */
const REMOVE_CONSEQUENCE =
  'Remove the bank balance. Difference goes back to N/A until you enter another.';

export default function ReconciliationBalanceBar({
  bankBalance,
  accountBalance,
  clearedBalance,
  currency,
  clearedSummary,
  onBankBalanceChange,
}: ReconciliationBalanceBarProps): React.JSX.Element {
  const { formatCurrency } = useCurrencyDecimal();
  const [isEditingBankBalance, setIsEditingBankBalance] = useState(false);
  const [editValue, setEditValue] = useState('');
  // What was just asked for, shown while the write is in flight. Wrapped in an
  // object because the value itself may legitimately be null (removed), so a
  // bare null could not tell "nothing pending" from "pending removal" apart.
  const [pendingBankBalance, setPendingBankBalance] = useState<{ value: number | null } | null>(null);
  const editFormRef = useRef<HTMLFormElement>(null);

  const displayBankBalance = pendingBankBalance ? pendingBankBalance.value : bankBalance;
  const difference = displayBankBalance != null
    ? toDecimal(displayBankBalance).minus(toDecimal(clearedBalance)).toNumber()
    : null;

  // The write landed: the prop is the truth again.
  useEffect(() => {
    setPendingBankBalance(pending => (pending && bankBalance === pending.value ? null : pending));
  }, [bankBalance]);

  const applyBankBalance = (value: number | null): void => {
    setPendingBankBalance({ value });
    onBankBalanceChange?.(value);
    setIsEditingBankBalance(false);
    setEditValue('');
  };

  const handleBankBalanceSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parseMoneyInput(editValue);
    if (parsed === null) {
      // Unreadable — leave whatever is recorded alone. Removing is deliberate
      // (the Remove control), never something a mistyped figure does for you.
      setIsEditingBankBalance(false);
      setEditValue('');
      return;
    }
    applyBankBalance(parsed);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-4">
      {/* Four figures side by side needs ~90px each; a 375px phone has room
          for two. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {/* Bank Balance */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Bank Balance</p>
          {displayBankBalance != null && !isEditingBankBalance ? (
            <button
              type="button"
              onClick={() => {
                setEditValue(String(displayBankBalance));
                setIsEditingBankBalance(true);
              }}
              className="text-lg font-bold text-gray-900 dark:text-white hover:text-primary transition-colors cursor-pointer"
              title="Click to change or remove"
            >
              {formatCurrency(displayBankBalance, currency)}
            </button>
          ) : isEditingBankBalance ? (
            <form ref={editFormRef} onSubmit={handleBankBalanceSubmit} className="flex flex-col gap-1">
              <MoneyInput
                // An overdrawn account's statement balance is negative.
                allowNegative
                value={editValue}
                onChange={setEditValue}
                className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                aria-label="Bank balance"
                autoFocus
                onBlur={event => {
                  // Moving onto Remove is still inside the editor. Closing here
                  // would unmount that button before its click ever landed.
                  if (editFormRef.current?.contains(event.relatedTarget)) return;
                  if (editValue.trim()) {
                    handleBankBalanceSubmit();
                  } else {
                    setIsEditingBankBalance(false);
                    setEditValue('');
                  }
                }}
              />
              {/* Only ever offered against a figure that exists — and only from
                  inside the editor, so it takes a deliberate click to reach.
                  preventDefault on mousedown keeps focus in the field: Safari
                  does not focus a button on click, so the blur above would
                  otherwise close the form out from under this one. */}
              {displayBankBalance != null && (
                <button
                  type="button"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => applyBankBalance(null)}
                  title={REMOVE_CONSEQUENCE}
                  aria-label={REMOVE_CONSEQUENCE}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:underline"
                >
                  Remove
                </button>
              )}
            </form>
          ) : (
            <button
              onClick={() => setIsEditingBankBalance(true)}
              className="text-sm text-primary hover:underline"
            >
              Enter balance
            </button>
          )}
        </div>

        {/* Account Balance */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Account Balance</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {formatCurrency(accountBalance, currency)}
          </p>
        </div>

        {/* Cleared Balance */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Cleared Balance</p>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(clearedBalance, currency)}
          </p>
        </div>

        {/* Difference */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Difference</p>
          {difference != null ? (
            <p className={`text-lg font-bold ${
              Math.abs(difference) < 0.005
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatCurrency(difference, currency)}
            </p>
          ) : (
            <p className="text-lg font-bold text-gray-400">N/A</p>
          )}
        </div>
      </div>

      {/* Cleared summary (MS Money-style session totals) */}
      {clearedSummary && clearedSummary.totalCount > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              {clearedSummary.clearedCount} of {clearedSummary.totalCount}
            </span>{' '}
            transactions cleared
          </span>
          <span>
            Cleared deposits:{' '}
            <span className="font-semibold text-green-600 dark:text-green-400">
              {formatCurrency(clearedSummary.depositsTotal, currency)}
            </span>{' '}
            ({clearedSummary.depositsCount})
          </span>
          <span>
            Cleared payments:{' '}
            <span className="font-semibold text-red-600 dark:text-red-400">
              {formatCurrency(clearedSummary.paymentsTotal, currency)}
            </span>{' '}
            ({clearedSummary.paymentsCount})
          </span>
        </div>
      )}
    </div>
  );
}
