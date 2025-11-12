import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, ArchiveIcon, RefreshCwIcon, CheckCircleIcon, XCircleIcon } from '../../components/icons';
import PageWrapper from '../../components/PageWrapper';
import { useApp } from '../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { useUserId } from '../../hooks/useUserId';
import { AccountService } from '../../services/api/accountService';
import { supabase } from '../../lib/supabase';
import type { Account } from '../../types';
import { createScopedLogger } from '../../loggers/scopedLogger';

const deletedAccountsLogger = createScopedLogger('DeletedAccountsPage');

export default function DeletedAccounts() {
  const navigate = useNavigate();
  const { accounts: activeAccounts, updateAccount } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { databaseId, isLoading: userIdLoading } = useUserId();
  const [deletedAccounts, setDeletedAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Fetch deleted accounts
  useEffect(() => {
    const fetchDeletedAccounts = async () => {
      // Wait for database ID to be available
      if (!databaseId || userIdLoading) {
        deletedAccountsLogger.info('Waiting for database ID');
        return;
      }
      
      deletedAccountsLogger.info('Fetching deleted accounts', { databaseId });
      setLoading(true);
      try {
        // Now fetch deleted accounts using the database user ID directly
        const { data, error } = await supabase!
          .from('accounts')
          .select('*')
          .eq('user_id', databaseId)
          .eq('is_active', false)
          .order('updated_at', { ascending: false });

        if (error) {
          deletedAccountsLogger.error('Error fetching deleted accounts', error);
        } else {
          deletedAccountsLogger.info('Deleted accounts fetched', { count: data?.length || 0 });
          if (data && data.length > 0) {
            deletedAccountsLogger.debug('Deleted accounts payload', data);
          }
          // Transform account types for UK users (checking -> current)
          const transformedAccounts = (data || []).map(account => ({
            ...account,
            type: account.type === 'checking' ? 'current' : account.type
          }));
          setDeletedAccounts(transformedAccounts);
        }
      } catch (error) {
        deletedAccountsLogger.error('Failed to fetch deleted accounts', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDeletedAccounts();
  }, [databaseId, userIdLoading]);

  // Handle account restoration
  const handleRestore = async (accountId: string) => {
    setRestoringId(accountId);
    try {
      // Update in database
      const { error } = await supabase!
        .from('accounts')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', accountId);

      if (error) {
        deletedAccountsLogger.error('Error restoring account', error);
        return;
      }

      // Remove from deleted list
      setDeletedAccounts(prev => prev.filter(acc => acc.id !== accountId));
      
      // Show success message
      const account = deletedAccounts.find(acc => acc.id === accountId);
      setSuccessMessage(`Account "${account?.name}" has been restored successfully!`);
      setTimeout(() => setSuccessMessage(''), 3000);

      // The realtime subscription should automatically update the main accounts list
      // If not using realtime, uncomment the line below:
      // window.location.reload();
    } catch (error) {
      deletedAccountsLogger.error('Failed to restore account', error);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <PageWrapper title="Deleted Accounts">
      <div className="mb-6">
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeftIcon size={20} />
          Back to Settings
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircleIcon size={20} />
            <span>{successMessage}</span>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-3">
          <ArchiveIcon size={24} className="text-blue-600 dark:text-blue-400 mt-1" />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">About Deleted Accounts</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Deleted accounts are hidden from your main accounts list but their transaction history 
              and transfer links are preserved. You can restore any deleted account at any time by 
              clicking the restore button next to it.
            </p>
          </div>
        </div>
      </div>

      {/* Deleted Accounts List */}
      <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Deleted Accounts ({deletedAccounts.length})
          </h2>
        </div>

        <div className="p-6">
          {loading || userIdLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading deleted accounts...
            </div>
          ) : deletedAccounts.length === 0 ? (
            <div className="text-center py-12">
              <ArchiveIcon size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No deleted accounts</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                When you delete an account, it will appear here for recovery
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {deletedAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {account.name}
                        </h4>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {account.type}
                          </span>
                          {account.institution && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {account.institution}
                            </span>
                          )}
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                            Last Balance: {formatCurrency(account.balance)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRestore(account.id)}
                    disabled={restoringId === account.id}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
                      ${restoringId === account.id
                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                      }
                    `}
                  >
                    <RefreshCwIcon size={16} className={restoringId === account.id ? 'animate-spin' : ''} />
                    {restoringId === account.id ? 'Restoring...' : 'Restore'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Permanent Deletion Warning */}
      {deletedAccounts.length > 0 && (
        <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start gap-3">
            <XCircleIcon size={20} className="text-yellow-600 dark:text-yellow-400 mt-1" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Note:</strong> Deleted accounts and their transactions are preserved indefinitely. 
                If you need to permanently remove an account and all its data, please contact support.
              </p>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
