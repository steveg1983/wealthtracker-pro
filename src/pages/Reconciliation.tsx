import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { ArrowLeftIcon, CheckCircleIcon } from '../components/icons';
import { useReconciliation } from '../hooks/useReconciliation';
import ReconciliationAccountList, { type ReconciliationGroup } from '../components/reconciliation/ReconciliationAccountList';
import { ALL_ACCOUNT_SECTIONS, sectionTypeForAccount } from '../utils/accountSections';
import ReconciliationBalanceBar, { CONFIRM_BALANCE_CONSEQUENCE } from '../components/reconciliation/ReconciliationBalanceBar';
import { UNCONFIRMED_YELLOW, CONFIRM_BALANCE_HINT_ID } from '../components/reconciliation/unconfirmedYellow';
import ReconciliationTransactionList from '../components/reconciliation/ReconciliationTransactionList';
import ReconciliationFinalizationModal from '../components/reconciliation/ReconciliationFinalizationModal';
import EditTransactionModal from '../components/EditTransactionModal';
import { preserveRuntimeControlParams } from '../utils/runtimeMode';
import { todayIsoDay } from '../utils/statementBankBalance';
import { toDecimal } from '../utils/decimal';
import type { Transaction } from '../types';
import { preferences } from '../services/preferencesService';

export default function Reconciliation() {
  const {
    transactions, accounts, categories, addTransaction, updateAccount,
    setTransactionsCleared, finalizeReconciliation
  } = useApp();
  const { showSuccess, showError } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    searchParams.get('account') || null
  );
  const navigate = useNavigate();
  // Where the user CAME FROM, captured once — later in-page query rewrites
  // (selecting an account re-writes the whole search string) would drop it.
  // Arriving via an Accounts-page reconcile button means "done" and "Back"
  // both return THERE, not to this page's own account list.
  const [cameFromAccounts] = useState<boolean>(() => searchParams.get('from') === 'accounts');
  // Group + sort for the account list — the same controls (and persistence
  // keys pattern) as the Accounts page, so the two pages always feel the same.
  const [groupBy, setGroupBy] = useState<'type' | 'institution'>(() =>
    (preferences.getItem('reconciliationGroupBy') as 'type' | 'institution') || 'type'
  );
  const [sortMode, setSortMode] = useState<'default' | 'name' | 'balance-desc' | 'balance-asc'>(() => {
    const stored = preferences.getItem('reconciliationSortMode');
    return stored === 'name' || stored === 'balance-desc' || stored === 'balance-asc' ? stored : 'default';
  });
  const handleGroupByChange = useCallback((value: 'type' | 'institution') => {
    setGroupBy(value);
    try { preferences.setItem('reconciliationGroupBy', value); } catch { /* storage unavailable */ }
  }, []);
  const handleSortChange = useCallback((value: 'default' | 'name' | 'balance-desc' | 'balance-asc') => {
    setSortMode(value);
    try { preferences.setItem('reconciliationSortMode', value); } catch { /* storage unavailable */ }
  }, []);
  // Hide the accounts that are already done — everything cleared AND no bank
  // balance difference — so the list is only the work. Grouping still applies:
  // the filter drops accounts within each section, never the sections shape.
  const [onlyAttention, setOnlyAttention] = useState<boolean>(() =>
    preferences.getItem('reconciliationOnlyAttention') === 'true'
  );
  const handleOnlyAttentionToggle = useCallback(() => {
    setOnlyAttention(prev => {
      const next = !prev;
      try { preferences.setItem('reconciliationOnlyAttention', String(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);
  const [showFinalizationModal, setShowFinalizationModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // Visible transaction order (sorted + filtered) as shown in the list, reported
  // by ReconciliationTransactionList. Drives "Save & Next" so it walks the same
  // order the user sees rather than the raw account order.
  const [visibleOrderIds, setVisibleOrderIds] = useState<string[]>([]);
  // Optimistic cleared-state overlay: the checkbox flips instantly while the
  // write is in flight, and reverts (with an error toast) if it fails.
  const [pendingCleared, setPendingCleared] = useState<Map<string, boolean>>(new Map());
  /**
   * The closing balance the user has AGREED to, for this account, in this
   * session.
   *
   * Deliberately in memory and deliberately per account. The owner asked to be
   * made to confirm a figure "each time", so next week's reconciliation must
   * ask again — persisting it would turn a decision into a default. The
   * account id rides along so switching accounts cannot carry an agreement
   * about one statement onto another.
   *
   * The amount is kept as well as the id because the figure can change under
   * the user (a feed sync, a statement import): an agreement is about a
   * NUMBER, so when the number moves the agreement lapses.
   */
  const [confirmedBalance, setConfirmedBalance] =
    useState<{ accountId: string; amount: number } | null>(null);

  const overlaidTransactions = useMemo(() => {
    if (pendingCleared.size === 0) return transactions;
    return transactions.map(t => {
      const pending = pendingCleared.get(t.id);
      return pending === undefined ? t : { ...t, cleared: pending };
    });
  }, [transactions, pendingCleared]);

  const {
    reconciliationDetails,
    totalUnreconciledCount,
    computeAccountBalance,
    computeClearedBalance,
    computeClearedSummary,
  } = useReconciliation(accounts, overlaidTransactions);

  // An account needs attention when transactions are still unreconciled, or a
  // stated bank balance disagrees with the cleared balance. difference is
  // Decimal-computed, so a balanced account is exactly 0.
  const attentionCount = useMemo(
    () =>
      reconciliationDetails.filter(
        s => s.unreconciledCount > 0 || (s.difference != null && s.difference !== 0)
      ).length,
    [reconciliationDetails]
  );

  // Build the grouped, sorted account list (same sections as the Accounts page).
  const accountGroups = useMemo<ReconciliationGroup[]>(() => {
    const visibleDetails = onlyAttention
      ? reconciliationDetails.filter(
          s => s.unreconciledCount > 0 || (s.difference != null && s.difference !== 0)
        )
      : reconciliationDetails;

    const sortSummaries = (list: typeof reconciliationDetails) => {
      const sorted = [...list];
      if (sortMode === 'name') sorted.sort((a, b) => a.account.name.localeCompare(b.account.name));
      else if (sortMode === 'balance-desc') sorted.sort((a, b) => b.accountBalance - a.accountBalance);
      else if (sortMode === 'balance-asc') sorted.sort((a, b) => a.accountBalance - b.accountBalance);
      return sorted;
    };

    if (groupBy === 'institution') {
      const byInstitution = new Map<string, typeof reconciliationDetails>();
      for (const s of visibleDetails) {
        const key = s.account.institution || 'Other Accounts';
        (byInstitution.get(key) ?? byInstitution.set(key, []).get(key)!).push(s);
      }
      return [...byInstitution.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([title, summaries]) => ({ title, summaries: sortSummaries(summaries) }));
    }

    // Same aliasing as the Accounts page (sectionTypeForAccount), so a
    // 'mortgage' account reconciles under Loans there AND here — this page's
    // old local catch-all put it under "Other" while Accounts showed it under
    // Loans, and the module exists precisely so the two cannot diverge.
    const groups: ReconciliationGroup[] = ALL_ACCOUNT_SECTIONS.map(section => ({
      title: section.title,
      summaries: sortSummaries(
        visibleDetails.filter(s => sectionTypeForAccount(s.account.type) === section.type)
      ),
    })).filter(g => g.summaries.length > 0);
    return groups;
  }, [reconciliationDetails, groupBy, sortMode, onlyAttention]);

  // Selected account data
  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );

  const accountTransactions = useMemo(
    () =>
      selectedAccountId
        ? overlaidTransactions.filter(t => t.accountId === selectedAccountId)
        : [],
    [overlaidTransactions, selectedAccountId]
  );

  const accountBalance = selectedAccountId ? computeAccountBalance(selectedAccountId) : 0;
  const clearedBalance = selectedAccountId ? computeClearedBalance(selectedAccountId) : 0;
  const clearedSummary = selectedAccountId ? computeClearedSummary(selectedAccountId) : undefined;
  /**
   * The closing balance the balance bar PROPOSES, and the order it is looked
   * for in. Note that none of these sources is itself a closing balance: they
   * are the best guesses at one, which is why the user has to agree before any
   * of them can settle a reconciliation.
   *
   *  1. what the bank most recently said (a feed sync or an imported statement
   *     writes `bankBalance`) — the closest thing to the statement in hand;
   *  2. failing that, the balance the last reconciliation was settled against,
   *     which is Money's "starting balance" for this one;
   *  3. failing both, nothing. An empty box, not a zero: a zero here would be a
   *     figure the app invented and the user could confirm by accident.
   *
   * Whichever it is, it is a SUGGESTION until confirmed.
   */
  const bankBalance = selectedAccount?.bankBalance ?? selectedAccount?.lastReconciledBalance ?? null;
  const balanceConfirmed =
    confirmedBalance != null && confirmedBalance.accountId === selectedAccountId;

  /**
   * The figure moved under the agreement — so the agreement lapses.
   *
   * Watches for a CHANGE rather than comparing on every render, and the
   * difference is load-bearing: confirming a figure the user has just typed
   * happens BEFORE the account update carrying it comes back, so a
   * compare-every-render rule would cancel every confirmation the instant it
   * was made. A change TO the confirmed figure (that same update landing) is
   * not a change to disagree with; a change to anything else — a feed sync, a
   * statement import — is, because what was agreed to is no longer on screen.
   */
  const lastSeenBankBalance = useRef<number | null>(bankBalance);
  const lastSeenAccountId = useRef<string | null>(selectedAccountId);
  useEffect(() => {
    if (lastSeenAccountId.current !== selectedAccountId) {
      // A different account's figure is not a change to this one's.
      lastSeenAccountId.current = selectedAccountId;
      lastSeenBankBalance.current = bankBalance;
      return;
    }
    if (lastSeenBankBalance.current === bankBalance) return;
    lastSeenBankBalance.current = bankBalance;
    setConfirmedBalance(prev => {
      if (prev === null) return prev;
      if (bankBalance !== null && toDecimal(prev.amount).equals(toDecimal(bankBalance))) return prev;
      return null;
    });
  }, [bankBalance, selectedAccountId]);

  // Handlers
  const handleSelectAccount = useCallback((accountId: string) => {
    setSelectedAccountId(accountId);
    // Preserve demo/testMode so an in-page navigation doesn't drop the flag that
    // keeps a demo/test session alive (which would bounce us to the landing page).
    setSearchParams(prev => preserveRuntimeControlParams(prev, { account: accountId }));
    // Same route, so the router restores nothing: without this, a scrolled
    // account list hands its scroll position to the detail view and the page
    // opens with the header off-screen.
    window.scrollTo(0, 0);
  }, [setSearchParams]);

  const handleBack = useCallback(() => {
    if (cameFromAccounts) {
      // Return whence the user came: the Accounts page sent them here for ONE
      // account, so leaving that account means leaving this page too.
      const params = new URLSearchParams(preserveRuntimeControlParams(searchParams));
      navigate({ pathname: '/accounts', search: params.toString() });
      return;
    }
    setSelectedAccountId(null);
    setSearchParams(prev => preserveRuntimeControlParams(prev));
    window.scrollTo(0, 0);
  }, [cameFromAccounts, searchParams, navigate, setSearchParams]);

  const applyCleared = useCallback(async (requestedIds: string[], cleared: boolean) => {
    // Drop ids that already have a write in flight — the checkbox is disabled
    // while pending, and skipping here closes the race for bulk overlaps too
    // (two in-flight writes for one id could otherwise resolve out of order).
    const ids = requestedIds.filter(id => !pendingCleared.has(id));
    if (ids.length === 0) {
      return;
    }

    // Optimistic: flip immediately, revert on failure.
    setPendingCleared(prev => {
      const next = new Map(prev);
      ids.forEach(id => next.set(id, cleared));
      return next;
    });

    try {
      await setTransactionsCleared(ids, cleared);
    } catch (error) {
      showError(error);
    } finally {
      setPendingCleared(prev => {
        const next = new Map(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }
  }, [pendingCleared, setTransactionsCleared, showError]);

  const handleToggleCleared = useCallback((transactionId: string, cleared: boolean) => {
    void applyCleared([transactionId], cleared);
  }, [applyCleared]);

  const handleBulkSetCleared = useCallback((transactionIds: string[], cleared: boolean) => {
    void applyCleared(transactionIds, cleared);
  }, [applyCleared]);

  const handleBankBalanceChange = useCallback((newBalance: number | null) => {
    if (!selectedAccountId) {
      return;
    }
    if (newBalance === null) {
      // The date goes with the figure it dated. A bank_balance_date describing
      // no balance is a claim about nothing — and worse than nothing, because
      // statementBankBalance judges an incoming statement stale against it, so
      // a leftover date would go on refusing statements after the balance it
      // belonged to was withdrawn.
      updateAccount(selectedAccountId, {
        bankBalance: null,
        bankBalanceDate: null
      });
      return;
    }
    // Dated as well as set. A figure typed here is what the bank says TODAY,
    // and recording that keeps bank_balance_date describing the balance it
    // sits beside — otherwise a hand-typed correction would inherit the date
    // of whatever statement was imported last, and a later import of that
    // statement's successor could be judged stale against it.
    updateAccount(selectedAccountId, {
      bankBalance: newBalance,
      bankBalanceDate: todayIsoDay()
    });
  }, [selectedAccountId, updateAccount]);

  /** Agree to the figure on screen. Nothing is written: this is a decision. */
  const handleConfirmBalance = useCallback((amount: number) => {
    if (!selectedAccountId) {
      return;
    }
    setConfirmedBalance({ accountId: selectedAccountId, amount });
  }, [selectedAccountId]);

  /** The user started changing the figure — whatever was agreed no longer is. */
  const handleBalanceEdited = useCallback(() => {
    setConfirmedBalance(null);
  }, []);

  /**
   * The one committing step. Everything before this was a working list.
   *
   * Gated on a confirmed balance twice over: the button that opens the modal is
   * disabled without one, and this refuses without one — because it is the
   * ending balance being written down, and a reconciliation settled against a
   * figure nobody read is the thing this whole change exists to prevent.
   */
  const handleFinalize = useCallback(async () => {
    if (!selectedAccountId || !balanceConfirmed || confirmedBalance == null) {
      return;
    }
    try {
      // Await the write — success feedback must not fire on a failed save.
      const reconciled = await finalizeReconciliation(
        selectedAccountId,
        confirmedBalance.amount,
        new Date()
      );
      setShowFinalizationModal(false);
      setConfirmedBalance(null);
      showSuccess(
        reconciled > 0
          ? `${reconciled.toLocaleString()} transaction${reconciled === 1 ? '' : 's'} reconciled.`
          : 'Nothing was left to reconcile; the statement balance is recorded.',
        'Account reconciled'
      );
      handleBack();
    } catch (error) {
      showError(error);
    }
  }, [
    selectedAccountId, balanceConfirmed, confirmedBalance, finalizeReconciliation,
    handleBack, showSuccess, showError
  ]);

  const handleCreateAdjustment = useCallback(async (data: {
    amount: number;
    type: 'income' | 'expense';
    description: string;
    category: string;
    date: Date;
  }) => {
    if (!selectedAccountId) return;

    const adjustmentTxn: Omit<Transaction, 'id'> = {
      date: data.date,
      description: data.description,
      amount: data.amount,
      type: data.type,
      category: data.category,
      accountId: selectedAccountId,
      // Marked, not reconciled: it has to count in the cleared balance for the
      // difference to close, and it becomes reconciled the same way every other
      // row does — when the user finalizes.
      cleared: true,
      reconciled: false,
    };

    try {
      // The modal stays open: the cleared adjustment shrinks the difference and
      // the modal re-renders with the remainder (zero → balanced state), so the
      // user can create several adjustments — the Microsoft Money model.
      await addTransaction(adjustmentTxn);
      showSuccess('Adjustment transaction created.', 'Adjustment added');
    } catch (error) {
      showError(error);
    }
  }, [selectedAccountId, addTransaction, showSuccess, showError]);

  const handleRowClick = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsEditModalOpen(true);
  }, []);

  const handleAddTransaction = useCallback(() => {
    setEditingTransaction(null);
    setIsEditModalOpen(true);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setEditingTransaction(null);
  }, []);

  const handleVisibleOrderChange = useCallback((orderedIds: string[]) => {
    setVisibleOrderIds(orderedIds);
  }, []);

  // "Save & Next" navigation: find the transaction shown immediately after the
  // current one, and swap it into the still-open modal. Mirrors AccountTransactions.
  const getNextTransactionId = useCallback((currentId: string): string | null => {
    const index = visibleOrderIds.indexOf(currentId);
    if (index === -1) return null;
    return visibleOrderIds[index + 1] ?? null;
  }, [visibleOrderIds]);

  const advanceToNextTransaction = useCallback((currentId: string): boolean => {
    const nextId = getNextTransactionId(currentId);
    if (!nextId) return false;
    const nextTransaction = accountTransactions.find(t => t.id === nextId) ?? null;
    if (!nextTransaction) return false;
    setEditingTransaction(nextTransaction);
    return true;
  }, [getNextTransactionId, accountTransactions]);

  const getPreviousTransactionId = useCallback((currentId: string): string | null => {
    const index = visibleOrderIds.indexOf(currentId);
    if (index <= 0) return null;
    return visibleOrderIds[index - 1] ?? null;
  }, [visibleOrderIds]);

  const advanceToPreviousTransaction = useCallback((currentId: string): boolean => {
    const previousId = getPreviousTransactionId(currentId);
    if (!previousId) return false;
    const previousTransaction = accountTransactions.find(t => t.id === previousId) ?? null;
    if (!previousTransaction) return false;
    setEditingTransaction(previousTransaction);
    return true;
  }, [getPreviousTransactionId, accountTransactions]);

  // Step 1: Account Selection
  if (!selectedAccountId) {
    return (
      <div className="flex flex-col h-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Reconciliation
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {totalUnreconciledCount > 0
              ? `${totalUnreconciledCount} unreconciled transactions across all accounts`
              : 'All accounts are up to date'}
          </p>
        </div>

        {/* Group + sort controls — mirrors the Accounts page */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4">
          <div className="w-full sm:w-auto flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 w-20 shrink-0">Group by:</span>
            <div className="grid grid-flow-col auto-cols-fr flex-1 sm:flex-none sm:inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
              {([['type', 'Account Type'], ['institution', 'Institution']] as const).map(([value, label]) => (
                <button key={value} onClick={() => handleGroupByChange(value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    groupBy === value
                      ? 'bg-[#1a2332] dark:bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full sm:w-auto flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 w-20 shrink-0">Sort:</span>
            <div className="grid grid-flow-col auto-cols-fr flex-1 sm:flex-none sm:inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
              <button onClick={() => handleSortChange('default')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  sortMode === 'default' ? 'bg-[#1a2332] dark:bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}>
                Default
              </button>
              <button onClick={() => handleSortChange('name')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  sortMode === 'name' ? 'bg-[#1a2332] dark:bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}>
                Name A–Z
              </button>
              <button onClick={() => handleSortChange(sortMode === 'balance-desc' ? 'balance-asc' : 'balance-desc')}
                title={sortMode === 'balance-desc'
                  ? 'Sorted highest value first — click for lowest first'
                  : sortMode === 'balance-asc'
                    ? 'Sorted lowest value first — click for highest first'
                    : 'Sort by account value'}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  sortMode === 'balance-desc' || sortMode === 'balance-asc'
                    ? 'bg-[#1a2332] dark:bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}>
                Value {sortMode === 'balance-asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
          <div className="w-full sm:w-auto flex items-center">
            <button
              type="button"
              onClick={handleOnlyAttentionToggle}
              aria-pressed={onlyAttention}
              title="Hide accounts that are fully reconciled with no balance difference"
              className={`w-full sm:w-auto px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                onlyAttention
                  ? 'bg-[#1a2332] dark:bg-blue-600 border-[#1a2332] dark:border-blue-600 text-white'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Needs attention only{attentionCount > 0 ? ` (${attentionCount})` : ''}
            </button>
          </div>
        </div>

        <ReconciliationAccountList
          groups={accountGroups}
          onSelectAccount={handleSelectAccount}
        />
      </div>
    );
  }

  // Step 2: Transaction Review
  return (
    <div className="flex flex-col h-full gap-4">
      {/* The header and balance bar stay pinned below the app nav while the
          transaction list scrolls: reconciliation is done by watching the
          cleared balance approach the bank's figure, so the numbers — and the
          way out, Finalize — must never scroll away. The negative margins
          bleed the strip across the page gutters so passing rows (and their
          shadows) never peek out at the sides. */}
      <div className="sticky top-16 md:top-12 z-30 bg-[#f8f9fb] dark:bg-gray-900 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 pb-2 flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              <ArrowLeftIcon size={20} />
              Back
            </button>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white truncate">
              {selectedAccount?.name ?? 'Account'}
            </h1>
          </div>

          {/* Disabled with the reason attached, and the reason itself is printed
              on the balance bar right under the box that has to be confirmed —
              a disabled button that will not say why is how people conclude the
              app is broken.
              The yellow is the same constant the closing-balance affordance
              wears, so the two are legible as one refusal: that figure is
              unconfirmed, therefore this will not press. Confirm it and both
              settle together — this becomes the app's ordinary primary action.
              Deliberately NOT dimmed with disabled:opacity-50 any more: a
              half-strength amber is not the same yellow as the bar's, which
              would break the very thread this draws. Nothing was lost, because
              the refusal was never carried by colour — the disabled attribute,
              the not-allowed cursor, the title and the described-by hint all
              still say it, and none of them are visual. */}
          <button
            type="button"
            onClick={() => setShowFinalizationModal(true)}
            disabled={!balanceConfirmed}
            aria-describedby={balanceConfirmed ? undefined : CONFIRM_BALANCE_HINT_ID}
            title={balanceConfirmed ? undefined : CONFIRM_BALANCE_CONSEQUENCE}
            /* Border width in both branches (transparent when ready) so the
               button does not resize as the gate opens. */
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors font-medium disabled:cursor-not-allowed ${
              balanceConfirmed
                ? 'border-transparent bg-[#1a2332] dark:bg-blue-600 text-white hover:bg-[#2d3a4d] dark:hover:bg-blue-700'
                : UNCONFIRMED_YELLOW
            }`}
          >
            <CheckCircleIcon size={18} />
            Finalize Reconciliation
          </button>
        </div>

        {/* Balance Bar */}
        <ReconciliationBalanceBar
          bankBalance={bankBalance}
          accountBalance={accountBalance}
          clearedBalance={clearedBalance}
          currency={selectedAccount?.currency}
          clearedSummary={clearedSummary}
          onBankBalanceChange={handleBankBalanceChange}
          lastReconciledDate={selectedAccount?.lastReconciledDate ?? null}
          lastReconciledBalance={selectedAccount?.lastReconciledBalance ?? null}
          balanceConfirmed={balanceConfirmed}
          onConfirmBalance={handleConfirmBalance}
          onBalanceEdited={handleBalanceEdited}
        />
      </div>

      {/* Transaction List */}
      <ReconciliationTransactionList
        transactions={accountTransactions}
        categories={categories}
        currency={selectedAccount?.currency}
        openingBalance={selectedAccount?.openingBalance ?? 0}
        pendingClearedIds={pendingCleared}
        onToggleCleared={handleToggleCleared}
        onBulkSetCleared={handleBulkSetCleared}
        onRowClick={handleRowClick}
        onAddTransaction={handleAddTransaction}
        onVisibleOrderChange={handleVisibleOrderChange}
      />

      {/* Edit / add transaction (new transactions default to this account) */}
      <EditTransactionModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        transaction={editingTransaction}
        defaultAccountId={selectedAccountId}
        onSaveAndNext={
          editingTransaction && getNextTransactionId(editingTransaction.id)
            ? () => {
                if (!advanceToNextTransaction(editingTransaction.id)) {
                  handleCloseEditModal();
                }
              }
            : undefined
        }
        onSaveAndPrevious={
          editingTransaction && getPreviousTransactionId(editingTransaction.id)
            ? () => { advanceToPreviousTransaction(editingTransaction.id); }
            : undefined
        }
      />

      {/* Finalization Modal. Rendered only against a CONFIRMED figure — there
          is no "finalize anyway" path any more, so the modal never has to
          reason about a balance that is not there. */}
      {confirmedBalance != null && balanceConfirmed && (
        <ReconciliationFinalizationModal
          isOpen={showFinalizationModal}
          confirmedBalance={confirmedBalance.amount}
          clearedBalance={clearedBalance}
          currency={selectedAccount?.currency}
          awaitingFinalizeCount={clearedSummary?.awaitingFinalizeCount ?? 0}
          onClose={() => setShowFinalizationModal(false)}
          onFinalize={handleFinalize}
          onCreateAdjustment={handleCreateAdjustment}
        />
      )}
    </div>
  );
}
