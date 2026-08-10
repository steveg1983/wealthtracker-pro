import React, { useState, useEffect, useRef } from 'react';
import { parseMoneyInput, toDecimal } from '../../utils/decimal';
import MoneyInput from '../common/MoneyInput';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { formatDate } from '../../utils/dateFormatter';
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
  /**
   * What the last finalized reconciliation settled on — Money's two facts at
   * the top of the window. `null` in either field means it has never happened,
   * and nothing is shown rather than a zero pretending to be a statement.
   */
  lastReconciledDate?: Date | null;
  lastReconciledBalance?: number | null;
  /**
   * Has the user AGREED to the figure on screen for this session?
   *
   * A prefilled box is a suggestion — from the bank feed, from the last
   * statement — and a suggestion nobody has looked at is not a statement
   * balance. Finalize is gated on this, and it is deliberately not persisted:
   * next week's reconciliation asks again.
   */
  balanceConfirmed?: boolean;
  /** Agree to the figure currently shown. */
  onConfirmBalance?: (amount: number) => void;
  /** The figure on screen changed under the user's hands: any agreement lapses. */
  onBalanceEdited?: () => void;
}

/**
 * What removing the figure costs, said in full wherever it is offered — and it
 * depends on what is left behind. With a last reconciliation on record the box
 * does not empty, it falls back to the balance that one ended on (Money's
 * starting balance), and a warning that promised N/A would be describing a
 * different screen.
 */
const REMOVE_CONSEQUENCE =
  'Remove the bank balance. Difference goes back to N/A until you enter another.';
const REMOVE_CONSEQUENCE_WITH_FALLBACK =
  'Remove the bank balance. Difference falls back to the balance your last reconciliation ended on, which you would then have to confirm.';

/**
 * Why Finalize is refusing, said beside the box that is refusing it — the
 * consequence, not a count. A reconciliation is a claim that the ledger agrees
 * with a statement, so the statement's figure has to be one a person actually
 * looked at.
 */
export const CONFIRM_BALANCE_CONSEQUENCE =
  'Confirm the bank balance to finish. Until you do, your marks stay a working list and nothing is reconciled.';

export default function ReconciliationBalanceBar({
  bankBalance,
  accountBalance,
  clearedBalance,
  currency,
  clearedSummary,
  onBankBalanceChange,
  lastReconciledDate,
  lastReconciledBalance,
  balanceConfirmed = false,
  onConfirmBalance,
  onBalanceEdited,
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
  const removeConsequence = lastReconciledBalance != null
    ? REMOVE_CONSEQUENCE_WITH_FALLBACK
    : REMOVE_CONSEQUENCE;
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
    // Typing a figure and pressing Enter IS confirming it: the person put that
    // number there on purpose, having just read it off a statement. The app's
    // save-commits idiom, and it saves a second click on the commonest path.
    onConfirmBalance?.(parsed);
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
                onChange={value => {
                  // Editing withdraws the agreement, the instant the figure
                  // stops being the one that was agreed to. Nothing is
                  // confirmed by accident here.
                  setEditValue(value);
                  onBalanceEdited?.();
                }}
                className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                aria-label="Bank balance"
                autoFocus
                onKeyDown={event => {
                  // Enter commits AND confirms. Written out rather than left to
                  // the form's implicit submission, which a browser only
                  // performs while this is the single field in the form — a
                  // second one added here would silently take the key away.
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  handleBankBalanceSubmit();
                }}
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
                  title={removeConsequence}
                  aria-label={removeConsequence}
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

          {/* Confirm sits under the figure it is about. It is offered whenever
              there is a figure to agree to — including £0.00, which is a real
              statement balance for an account swept to zero every night, and
              which the app must never confuse with "no balance". */}
          {displayBankBalance != null && !isEditingBankBalance && (
            balanceConfirmed ? (
              <p className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                Confirmed
              </p>
            ) : (
              <button
                type="button"
                onClick={() => onConfirmBalance?.(displayBankBalance)}
                title={CONFIRM_BALANCE_CONSEQUENCE}
                className="mt-1 px-2 py-0.5 text-xs font-medium rounded border border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30"
              >
                Confirm
              </button>
            )
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

      {/* Why Finalize is refusing, beside the box that is refusing it. Said as
          the consequence — what the marks are worth until it is done — rather
          than as an instruction with no reason attached. */}
      {!balanceConfirmed && (
        <p
          id="reconciliation-confirm-hint"
          className="mt-3 text-xs text-amber-700 dark:text-amber-400 text-center"
        >
          {CONFIRM_BALANCE_CONSEQUENCE}
        </p>
      )}

      {/* Money's two facts about last time: when, and against what. Shown only
          when both are known — a date with no figure is a claim nobody can
          check, and a figure with no date is not a statement. */}
      {lastReconciledDate != null && lastReconciledBalance != null && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
          Last reconciled: {formatDate(lastReconciledDate)} · ending balance{' '}
          {formatCurrency(lastReconciledBalance, currency)}
        </p>
      )}

      {/* Cleared summary (MS Money-style session totals) */}
      {clearedSummary && clearedSummary.totalCount > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              {clearedSummary.clearedCount} of {clearedSummary.totalCount}
            </span>{' '}
            transactions marked
          </span>
          <span>
            Marked deposits:{' '}
            <span className="font-semibold text-green-600 dark:text-green-400">
              {formatCurrency(clearedSummary.depositsTotal, currency)}
            </span>{' '}
            ({clearedSummary.depositsCount})
          </span>
          <span>
            Marked payments:{' '}
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
