import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { planRename, type PayeeSummary } from '../utils/payeeCleanup';

/**
 * Rename many payees to one name.
 *
 * The whole point of the dialog is the sentence before the button: a rename
 * REPLACES the bank's own wording on every transaction behind the selection,
 * and the app has no way to put it back. So the confirm step names the
 * consequence — how many transactions, from how many payees, and what is lost
 * — rather than just showing a number and a verb.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** The payees ticked on the cleanup screen. */
  selected: PayeeSummary[];
  /** Called after a successful rename so the screen can clear its selection. */
  onRenamed: (newDescription: string, transactionsRenamed: number) => void;
}

export default function RenamePayeesModal({
  isOpen,
  onClose,
  selected,
  onRenamed
}: Props): React.JSX.Element {
  const { transactions, renameTransactionDescriptions } = useApp();
  const { showSuccess, showError } = useToast();
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [progress, setProgress] = useState(0);

  // A fresh dialog every time it opens: leaving the previous name in the box
  // is how somebody renames a second batch to the first batch's name without
  // noticing.
  useEffect(() => {
    if (isOpen) {
      setNewName('');
      setProgress(0);
    }
  }, [isOpen]);

  const selectedDescriptions = useMemo(
    () => new Set(selected.map(s => s.description)),
    [selected]
  );

  const plan = useMemo(
    () => planRename(transactions, selectedDescriptions, newName),
    [transactions, selectedDescriptions, newName]
  );

  /**
   * The merchant every selected payee already looks like, when they agree —
   * offered as a one-click fill rather than pre-filled into the box, because
   * a pre-filled name is one the user can confirm without ever having read
   * it, and this action cannot be undone.
   */
  const sharedMerchant = useMemo(() => {
    if (selected.length < 2) return null;
    const first = selected[0].merchantKey;
    if (first === null) return null;
    return selected.every(s => s.merchantKey === first) ? first : null;
  }, [selected]);

  const trimmedName = newName.trim();
  const canRename = trimmedName !== '' && plan.transactionIds.length > 0 && !renaming;

  /**
   * Enter in the name box does what the button does — the register's own
   * keyboard grammar, where typing and pressing Enter is how everything is
   * committed. Native submission rather than a keydown handler, so the browser
   * decides what "submit this form" means and the button stays a real submit
   * button.
   *
   * `canRename` gates BOTH: an empty or whitespace name, nothing selected, and
   * a rename already running each stop it here as well as on the button.
   * Without that last one Enter could fire a second rename over the first —
   * a disabled button cannot be clicked twice, but Enter does not ask the
   * button's permission.
   */
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canRename) return;
    void handleRename();
  };

  const handleRename = async (): Promise<void> => {
    setRenaming(true);
    setProgress(0);
    try {
      const renamed = await renameTransactionDescriptions(
        plan.transactionIds,
        trimmedName,
        setProgress
      );
      showSuccess(
        `${renamed.toLocaleString()} transaction${renamed === 1 ? '' : 's'} now read "${trimmedName}".`,
        'Payees renamed'
      );
      onRenamed(trimmedName, renamed);
      onClose();
    } catch (error) {
      showError(error);
    } finally {
      setRenaming(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={renaming ? () => {} : onClose}
      closeOnBackdrop={!renaming}
      title="Rename selected payees"
      size="lg"
    >
      {/* The body and the footer inside ONE form, which is what makes Enter in
          the name box press the button below it. Modal already lays out a
          direct <form> child as the flex column its own children would be. */}
      <form onSubmit={handleSubmit}>
      <ModalBody className="space-y-4">
        <div>
          <label htmlFor="new-payee-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            New payee name
          </label>
          <input
            id="new-payee-name"
            type="text"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={renaming}
            placeholder="e.g. Amazon"
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:border-transparent dark:text-white disabled:opacity-50"
          />
          {sharedMerchant !== null && trimmedName !== sharedMerchant && (
            <button
              type="button"
              onClick={() => setNewName(sharedMerchant)}
              disabled={renaming}
              className="mt-2 text-xs text-blue-700 dark:text-blue-400 hover:underline disabled:opacity-50"
            >
              use {sharedMerchant}
            </button>
          )}
        </div>

        {/* The consequence, in the order it matters: what changes, how much of
            it, and what can never be got back. */}
        <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 space-y-2">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {trimmedName === '' ? (
              <>Type a name above to see exactly what would change.</>
            ) : (
              <>
                This rewrites the payee on{' '}
                <strong>{plan.transactionIds.length.toLocaleString()} transaction
                {plan.transactionIds.length === 1 ? '' : 's'}</strong>, drawn from{' '}
                <strong>{plan.payeesChanging.toLocaleString()} payee
                {plan.payeesChanging === 1 ? '' : 's'}</strong>, so that every one of
                them reads "{trimmedName}".
              </>
            )}
          </p>
          <p className="text-sm text-amber-900 dark:text-amber-200">
            The bank's original wording is replaced, not kept alongside. It is
            what your register, exports and reports show, and nothing in the app
            can put it back — a re-import from the bank is the only way to
            recover it.
          </p>
          {/* Auto-categorisation matches new imports against the payee text of
              existing rows. Renaming moves that goalpost, and a user deserves
              to know before they lose a month of it. */}
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Future imports arrive with the bank's wording, so any payee whose
            text was already stable stops auto-categorising until you file it
            once under its new name.
          </p>
          {plan.payeesUnchanged > 0 && (
            <p className="text-sm text-amber-900 dark:text-amber-200">
              {plan.payeesUnchanged.toLocaleString()} selected payee
              {plan.payeesUnchanged === 1 ? ' is' : 's are'} already called
              "{trimmedName}" and will not be touched.
            </p>
          )}
        </div>

        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Payees being renamed
          </p>
          <ul className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/60">
            {selected.map(payee => (
              <li
                key={payee.description}
                className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-xs"
              >
                <span className="truncate text-gray-700 dark:text-gray-300">{payee.description}</span>
                <span className="shrink-0 tabular-nums text-gray-400 dark:text-gray-500">
                  {payee.count.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {renaming
              ? `Renaming ${progress.toLocaleString()} of ${plan.transactionIds.length.toLocaleString()}…`
              : `${selected.length.toLocaleString()} payee${selected.length === 1 ? '' : 's'} selected`}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={renaming}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canRename}
              className="justify-center px-4 py-2 text-sm font-medium rounded-lg bg-primary-action text-on-primary-action hover:bg-primary-action-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {renaming
                ? 'Renaming…'
                : `Rename ${plan.transactionIds.length.toLocaleString()} transaction${plan.transactionIds.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </ModalFooter>
      </form>
    </Modal>
  );
}
