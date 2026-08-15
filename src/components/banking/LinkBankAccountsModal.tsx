import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { Modal, ModalBody, ModalFooter } from '../common/Modal';
import { bankConnectionService } from '../../services/bankConnectionService';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { lazyWithRecovery } from '../../utils/lazyWithRecovery';
import LazyErrorBoundary from '../LazyErrorBoundary';
import type { DiscoveredBankAccount } from '../../types/banking-api';
import type { Account } from '../../types';

import AccountSelector from '../common/AccountSelector';
import { CREATE_NEW_VALUE } from './accountPickerOptions';
import { accountNumberForStorage, formatCardNumberForDisplay } from '../../utils/accountNumberInput';

// The only lazy import in the app that must NOT reload the page on its own.
// It is reached part-way through linking a bank connection: discovery has
// already run against the bank, and the user has matched accounts by hand.
// Reloading would discard every match and re-run discovery, so a stale chunk
// is handled in place instead (see the fallback below) — they can link what
// they have matched and choose when to take the update.
const AddAccountModal = lazyWithRecovery(() => import('../AddAccountModal'), { autoReload: false });

interface LinkBankAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  onLinkComplete: (connectionId: string) => void;
}

interface AccountLink {
  externalAccountId: string;
  selectedAccountId: string; // '' means skip
}

const normalizeSortCode = (value: string | undefined): string =>
  (value ?? '').replace(/[\s-]/g, '').toLowerCase();

const normalizeAccountNumber = (value: string | undefined): string =>
  (value ?? '').replace(/\s/g, '').toLowerCase();

const isCard = (discovered: DiscoveredBankAccount): boolean =>
  discovered.kind === 'card' || discovered.type === 'credit';

/**
 * The number this discovered account may be shown as, or linked with.
 *
 * TrueLayer's cards surface publishes a last-4 mask and nothing else, but a
 * credit card reached through the ACCOUNTS surface (account_type
 * "credit_card") carries account_number.number — the full card number. Linking
 * writes that field onto the account row, so it is cut to the last 4 here,
 * before it can be displayed, prefilled into the new-account form, or sent to
 * /api/banking/link-accounts.
 */
const linkableAccountNumber = (discovered: DiscoveredBankAccount): string | undefined =>
  accountNumberForStorage(discovered.accountNumber, isCard(discovered));

// Cards expose no sort code or account number — only a last-4 mask. Restrict
// mask matching to credit accounts, and only auto-select on a unique hit, so
// a shared last-4 across accounts can't mislink.
const findCardMaskMatch = (
  discovered: DiscoveredBankAccount,
  existingAccounts: Account[]
): Account | null => {
  if (!isCard(discovered) || !discovered.mask) {
    return null;
  }
  const matches = existingAccounts.filter((account) => {
    if (account.type !== 'credit') {
      return false;
    }
    const aAccountNumber = normalizeAccountNumber(account.accountNumber);
    return aAccountNumber.length >= 4 && aAccountNumber.slice(-4) === discovered.mask;
  });
  return matches.length === 1 ? matches[0] : null;
};

const findSmartMatch = (
  discovered: DiscoveredBankAccount,
  existingAccounts: Account[]
): string | null => {
  const dSortCode = normalizeSortCode(discovered.sortCode);
  const dAccountNumber = normalizeAccountNumber(discovered.accountNumber);

  if (!dSortCode && !dAccountNumber) {
    return findCardMaskMatch(discovered, existingAccounts)?.id ?? null;
  }

  for (const account of existingAccounts) {
    const aSortCode = normalizeSortCode(account.sortCode);
    const aAccountNumber = normalizeAccountNumber(account.accountNumber);

    // Both sort code and account number match
    if (dSortCode && dAccountNumber && aSortCode === dSortCode && aAccountNumber === dAccountNumber) {
      return account.id;
    }

    // Account number only match (when sort codes not available)
    if (!dSortCode && dAccountNumber && aAccountNumber === dAccountNumber) {
      return account.id;
    }
  }

  return null;
};

const formatSortCode = (raw: string | undefined): string => {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
};

const getMatchReason = (
  discovered: DiscoveredBankAccount,
  existingAccounts: Account[]
): string | null => {
  const dSortCode = normalizeSortCode(discovered.sortCode);
  const dAccountNumber = normalizeAccountNumber(discovered.accountNumber);

  if (!dSortCode && !dAccountNumber) {
    const cardMatch = findCardMaskMatch(discovered, existingAccounts);
    return cardMatch ? `Card ending ${discovered.mask} matches` : null;
  }

  for (const account of existingAccounts) {
    const aSortCode = normalizeSortCode(account.sortCode);
    const aAccountNumber = normalizeAccountNumber(account.accountNumber);

    if (dSortCode && dAccountNumber && aSortCode === dSortCode && aAccountNumber === dAccountNumber) {
      return `Sort code ${formatSortCode(discovered.sortCode)} and account ****${dAccountNumber.slice(-4)} match`;
    }

    if (!dSortCode && dAccountNumber && aAccountNumber === dAccountNumber) {
      return `Account number ****${dAccountNumber.slice(-4)} matches`;
    }
  }

  return null;
};



export default function LinkBankAccountsModal({
  isOpen,
  onClose,
  connectionId,
  onLinkComplete
}: LinkBankAccountsModalProps): React.JSX.Element | null {
  const { accounts } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [discoveredAccounts, setDiscoveredAccounts] = useState<DiscoveredBankAccount[]>([]);
  const [links, setLinks] = useState<AccountLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createAccountFor, setCreateAccountFor] = useState<string | null>(null);
  // Set when linking succeeded but the bank would not give a balance for some
  // of the accounts. Holding the modal open is the only chance to say so:
  // onLinkComplete closes it, and nothing downstream would mention it.
  const [unconfirmedBalanceNames, setUnconfirmedBalanceNames] = useState<string[] | null>(null);

  // A closed account cannot take a live bank feed, so it is never offered as
  // a link target — belt and braces, since the context carries open ones only.
  const linkableAccounts = useMemo(
    () => accounts.filter((a) => a.isActive !== false),
    [accounts]
  );

  const loadDiscoveredAccounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const discovered = await bankConnectionService.discoverAccounts(connectionId);
      setDiscoveredAccounts(discovered);

      // Initialize links with smart matches
      const initialLinks: AccountLink[] = discovered.map((da) => {
        const matchedId = findSmartMatch(da, accounts);
        return {
          externalAccountId: da.externalAccountId,
          selectedAccountId: matchedId ?? ''
        };
      });
      setLinks(initialLinks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover bank accounts');
    } finally {
      setIsLoading(false);
    }
  }, [connectionId, accounts]);

  useEffect(() => {
    if (isOpen && connectionId) {
      loadDiscoveredAccounts();
    }
  }, [isOpen, connectionId, loadDiscoveredAccounts]);

  // Leaving the create-account step: the dropdown that opened it goes back to
  // "skip" so it never claims an account that was never created.
  const cancelCreateAccount = useCallback(() => {
    setLinks(prev => prev.map(link =>
      link.externalAccountId === createAccountFor
        ? { ...link, selectedAccountId: '' }
        : link
    ));
    setCreateAccountFor(null);
  }, [createAccountFor]);

  const updateLink = (externalAccountId: string, selectedAccountId: string) => {
    if (selectedAccountId === CREATE_NEW_VALUE) {
      setCreateAccountFor(externalAccountId);
      return;
    }
    setLinks((prev) =>
      prev.map((link) =>
        link.externalAccountId === externalAccountId
          ? { ...link, selectedAccountId }
          : link
      )
    );
  };

  const handleLink = async () => {
    const selectedLinks = links.filter((l) => l.selectedAccountId !== '' && l.selectedAccountId !== CREATE_NEW_VALUE);
    if (selectedLinks.length === 0) {
      setError('Please select at least one account to link');
      return;
    }

    setIsLinking(true);
    setError(null);
    try {
      // No balance is sent. The server reads it from the bank itself at snap
      // time, so a discovery call that failed here can never be turned into a
      // figure written to an account.
      const linkPayload = selectedLinks.map((sl) => {
        const discovered = discoveredAccounts.find(
          (da) => da.externalAccountId === sl.externalAccountId
        );
        return {
          externalAccountId: sl.externalAccountId,
          accountId: sl.selectedAccountId,
          externalAccountName: discovered?.name ?? '',
          externalAccountMask: discovered?.mask,
          sortCode: discovered?.sortCode,
          accountNumber: discovered ? linkableAccountNumber(discovered) : undefined,
          kind: discovered?.kind
        };
      });

      const result = await bankConnectionService.linkAccounts(connectionId, linkPayload);
      const unconfirmed = result.balancesUnavailable ?? [];
      if (unconfirmed.length > 0) {
        setUnconfirmedBalanceNames(unconfirmed.map((entry) => entry.name));
        return;
      }
      onLinkComplete(connectionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link accounts');
    } finally {
      setIsLinking(false);
    }
  };

  const linkedCount = links.filter((l) => l.selectedAccountId !== '' && l.selectedAccountId !== CREATE_NEW_VALUE).length;

  // Check for duplicate account selections
  const selectedIds = links
    .filter((l) => l.selectedAccountId !== '' && l.selectedAccountId !== CREATE_NEW_VALUE)
    .map((l) => l.selectedAccountId);
  const hasDuplicates = new Set(selectedIds).size !== selectedIds.length;

  if (!isOpen) return null;

  // Linked, but the bank would not say what one or more of these accounts
  // holds. The alternative to telling the user is writing a number nobody
  // reported, so the wizard stops here and names the consequence: those
  // accounts kept the balance they already had.
  if (unconfirmedBalanceNames) {
    const finishLinking = (): void => {
      setUnconfirmedBalanceNames(null);
      onLinkComplete(connectionId);
    };
    const isOne = unconfirmedBalanceNames.length === 1;
    return (
      <Modal isOpen={isOpen} onClose={finishLinking} title="Accounts linked" size="sm">
        <ModalBody className="space-y-3">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Your accounts are linked and transactions will now import.
          </p>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3 space-y-2">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Your bank didn&apos;t give a balance for {unconfirmedBalanceNames.join(', ')}.
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {isOne ? 'That account keeps' : 'Those accounts keep'} the balance you already
              had — nothing was changed to a figure your bank never reported. Reconciliation
              will show no bank balance for {isOne ? 'it' : 'them'} until a sync gets one.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={finishLinking}
            className="w-full justify-center bg-[#1a2332] text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors"
          >
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title="Link Your Bank Accounts" size="lg">
      <ModalBody className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <span className="ml-3 text-gray-500 dark:text-gray-400">
              Discovering bank accounts...
            </span>
          </div>
        ) : discoveredAccounts.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-lg font-medium">No accounts found</p>
            <p className="text-sm mt-1">
              No bank accounts were found for this connection.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select which of your existing accounts each bank account should be linked to.
              Matching accounts are auto-suggested based on sort code and account number.
            </p>

            <div className="space-y-4">
              {discoveredAccounts.map((da) => {
                const link = links.find(
                  (l) => l.externalAccountId === da.externalAccountId
                );
                const selectedId = link?.selectedAccountId ?? '';
                const isMatched = findSmartMatch(da, accounts) !== null;
                // A card's number is shown the way a card's number is shown
                // everywhere else — masked to its last 4. A bank account's is
                // the real 8-digit number and is shown whole.
                const shownAccountNumber = isCard(da)
                  ? formatCardNumberForDisplay(linkableAccountNumber(da))
                  : da.accountNumber ?? '';

                return (
                  <div
                    key={da.externalAccountId}
                    className={`rounded-xl border-2 p-4 transition-colors ${
                      selectedId
                        ? 'border-[#1a2332]/50 bg-[#1a2332]/5 dark:bg-[#1a2332]/10'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    }`}
                  >
                    {/* Bank account info */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {da.name}
                        </h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {da.sortCode && (
                            <span>Sort Code: {formatSortCode(da.sortCode)}</span>
                          )}
                          {shownAccountNumber && (
                            <span>Account: {shownAccountNumber}</span>
                          )}
                          {da.mask && !shownAccountNumber && (
                            <span>****{da.mask}</span>
                          )}
                          <span className="capitalize">{da.type === 'checking' ? 'Current' : da.type}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        {/* A balance the bank did not report is said to be
                            missing, not shown as £0.00. The user is choosing
                            what to link against — and, through Create New
                            Account, what opening balance to type — so they
                            need to know the figure is absent rather than
                            zero. */}
                        {da.balance === null ? (
                          <p className="font-medium text-amber-700 dark:text-amber-400">
                            Balance not reported
                          </p>
                        ) : (
                          <p className="font-semibold text-gray-900 dark:text-white tabular-nums">
                            {formatCurrency(da.balance, da.currency)}
                          </p>
                        )}
                        {isMatched && selectedId && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 mt-1">
                            Auto-matched
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Account selector */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Link to:
                      </label>
                      {/* The one account picker, shared with every
                          transaction editor: the same bands, the same
                          type-to-filter (name, bank or sort code), plus this
                          wizard's own skip and create rows. The institution
                          is a band heading here, so a row prints its name
                          and — where two accounts share one — its sort code. */}
                      <AccountSelector
                        accounts={linkableAccounts}
                        selectedAccountId={selectedId}
                        onAccountChange={(v) => updateLink(da.externalAccountId, v)}
                        ariaLabel={`Link ${da.name} to account`}
                        placeholder="Skip (don't link)"
                        searchPlaceholder="Type to search accounts…"
                        clearOption="Skip (don't link)"
                        createOption={{ label: 'Create New Account', value: CREATE_NEW_VALUE }}
                        formatLabel={(a) => (a.sortCode ? `${a.name} — ${a.sortCode}` : a.name)}
                        usePortal
                      />

                      {/* Match reason */}
                      {isMatched && selectedId && (() => {
                        const reason = getMatchReason(da, accounts);
                        return reason ? (
                          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                            Matched: {reason}
                          </p>
                        ) : null;
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>

            {hasDuplicates && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Warning: Multiple bank accounts are linked to the same WealthTracker account. Each bank account should be linked to a different account.
                </p>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <div className="flex gap-3 w-full">
          <button
            type="button"
            onClick={handleLink}
            disabled={isLoading || isLinking || linkedCount === 0 || hasDuplicates}
            className="flex-1 justify-center bg-[#1a2332] text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLinking
              ? 'Linking...'
              : `Link ${linkedCount} Account${linkedCount !== 1 ? 's' : ''}`}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 justify-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </ModalFooter>
    </Modal>

    {/* Create New Account sub-modal */}
    {createAccountFor && (() => {
      const da = discoveredAccounts.find(d => d.externalAccountId === createAccountFor);
      return (
        <LazyErrorBoundary
          componentName="the new account form"
          fallback={
            <Modal
              isOpen={true}
              onClose={cancelCreateAccount}
              title="Couldn't open the new account form"
              size="sm"
            >
              <ModalBody>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This tab couldn&apos;t load the form — usually because WealthTracker has
                  been updated since you opened this screen. Your matches are still here:
                  link them first if you want to keep them, because reloading starts this
                  screen again.
                </p>
              </ModalBody>
              <ModalFooter>
                <div className="flex gap-3 w-full">
                  <button
                    type="button"
                    onClick={cancelCreateAccount}
                    className="flex-1 justify-center bg-[#1a2332] text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors"
                  >
                    Back to matching
                  </button>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="flex-1 justify-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Reload
                  </button>
                </div>
              </ModalFooter>
            </Modal>
          }
        >
          <Suspense fallback={null}>
            <AddAccountModal
              isOpen={true}
              onClose={cancelCreateAccount}
              prefill={{
                name: da?.name,
                type: da?.type === 'checking' ? 'current' : da?.type as 'current' | 'savings' | 'credit' | 'loan' | 'investment' | 'assets' | 'other' | undefined,
                // Undefined when the bank reported no balance, so the field
                // opens empty for the user to fill in. Never default it to
                // '0': that is the fabrication this whole path removes, and
                // an account opened at a false zero stays wrong for good —
                // the first import rebases initial_balance around it.
                balance: da?.balance?.toString(),
                currency: da?.currency,
                sortCode: da?.sortCode,
                accountNumber: da ? linkableAccountNumber(da) : undefined,
              }}
              onAccountCreated={(newAccountId) => {
                setLinks(prev => prev.map(link =>
                  link.externalAccountId === createAccountFor
                    ? { ...link, selectedAccountId: newAccountId }
                    : link
                ));
                setCreateAccountFor(null);
              }}
            />
          </Suspense>
        </LazyErrorBoundary>
      );
    })()}
    </>
  );
}
