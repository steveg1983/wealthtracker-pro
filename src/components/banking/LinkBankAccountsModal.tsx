import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { Modal, ModalBody, ModalFooter } from '../common/Modal';
import { bankConnectionService } from '../../services/bankConnectionService';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { DiscoveredBankAccount } from '../../types/banking-api';
import type { Account } from '../../types';

const AddAccountModal = lazy(() => import('../AddAccountModal'));

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

const findSmartMatch = (
  discovered: DiscoveredBankAccount,
  existingAccounts: Account[]
): string | null => {
  const dSortCode = normalizeSortCode(discovered.sortCode);
  const dAccountNumber = normalizeAccountNumber(discovered.accountNumber);

  if (!dSortCode && !dAccountNumber) {
    return null;
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

  if (!dSortCode && !dAccountNumber) return null;

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

const CREATE_NEW_VALUE = '__create_new__';

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
      const linkPayload = selectedLinks.map((sl) => {
        const discovered = discoveredAccounts.find(
          (da) => da.externalAccountId === sl.externalAccountId
        );
        return {
          externalAccountId: sl.externalAccountId,
          accountId: sl.selectedAccountId,
          externalAccountName: discovered?.name ?? '',
          externalAccountMask: discovered?.mask,
          balance: discovered?.balance ?? 0
        };
      });

      await bankConnectionService.linkAccounts(connectionId, linkPayload);
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

                return (
                  <div
                    key={da.externalAccountId}
                    className={`rounded-xl border-2 p-4 transition-colors ${
                      selectedId
                        ? 'border-primary/50 bg-primary/5 dark:bg-primary/10'
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
                          {da.accountNumber && (
                            <span>Account: {da.accountNumber}</span>
                          )}
                          {da.mask && !da.accountNumber && (
                            <span>****{da.mask}</span>
                          )}
                          <span className="capitalize">{da.type === 'checking' ? 'Current' : da.type}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 dark:text-white tabular-nums">
                          {formatCurrency(da.balance, da.currency)}
                        </p>
                        {isMatched && selectedId && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 mt-1">
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
                      <select
                        value={selectedId}
                        onChange={(e) =>
                          updateLink(da.externalAccountId, e.target.value)
                        }
                        aria-label={`Link ${da.name} to account`}
                        className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white text-sm"
                      >
                        <option value="">-- Skip (don&apos;t link) --</option>
                        {accounts
                          .filter((a) => a.isActive !== false)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                              {a.institution ? ` (${a.institution})` : ''}
                              {a.sortCode ? ` - ${a.sortCode}` : ''}
                            </option>
                          ))}
                        <option value={CREATE_NEW_VALUE}>+ Create New Account</option>
                      </select>

                      {/* Match reason */}
                      {isMatched && selectedId && (() => {
                        const reason = getMatchReason(da, accounts);
                        return reason ? (
                          <p className="text-xs text-green-700 dark:text-green-400 mt-1">
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
            className="flex-1 bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLinking
              ? 'Linking...'
              : `Link ${linkedCount} Account${linkedCount !== 1 ? 's' : ''}`}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
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
        <Suspense fallback={null}>
          <AddAccountModal
            isOpen={true}
            onClose={() => {
              // Reset dropdown to skip since they cancelled
              setLinks(prev => prev.map(link =>
                link.externalAccountId === createAccountFor
                  ? { ...link, selectedAccountId: '' }
                  : link
              ));
              setCreateAccountFor(null);
            }}
            prefill={{
              name: da?.name,
              type: da?.type === 'checking' ? 'current' : da?.type as 'current' | 'savings' | 'credit' | 'loan' | 'investment' | 'assets' | 'other' | undefined,
              balance: da?.balance?.toString(),
              currency: da?.currency,
              sortCode: da?.sortCode,
              accountNumber: da?.accountNumber,
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
      );
    })()}
    </>
  );
}
