import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import EnhancedTransferModal from '../components/EnhancedTransferModal';
import PageWrapper from '../components/PageWrapper';
import { PlusIcon } from '../components/icons/PlusIcon';
import { ArrowRightIcon } from '../components/icons/ArrowRightIcon';
import { FilterIcon } from '../components/icons/FilterIcon';
import { AlertCircleIcon } from '../components/icons/AlertCircleIcon';
import { CheckCircleIcon } from '../components/icons/CheckCircleIcon';
import { ClockIcon } from '../components/icons/ClockIcon';
import { format } from 'date-fns';
import type { Transaction } from '../types';

export default function TransferCenter() {
  const { transactions, accounts, categories } = useApp();
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transaction | undefined>();
  const [filterPeriod, setFilterPeriod] = useState<'all' | '30d' | '90d' | '1y'>('30d');
  const [filterAccount, setFilterAccount] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'settled' | 'reconciled'>('all');
  
  // Get all transfer transactions
  const transfers = useMemo(() => {
    return transactions.filter(t => t.type === 'transfer');
  }, [transactions]);
  
  // Apply filters
  const filteredTransfers = useMemo(() => {
    let filtered = [...transfers];
    
    // Period filter
    if (filterPeriod !== 'all') {
      const now = new Date();
      const days = filterPeriod === '30d' ? 30 : filterPeriod === '90d' ? 90 : 365;
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(t => new Date(t.date) >= cutoff);
    }
    
    // Account filter
    if (filterAccount) {
      filtered = filtered.filter(t => 
        t.accountId === filterAccount || 
        categories.find(c => c.id === t.category)?.accountId === filterAccount
      );
    }
    
    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(t => {
        const status = t.transferMetadata?.reconciliationStatus || 'pending';
        if (filterStatus === 'settled') {
          return t.transferMetadata?.settlementDate && new Date(t.transferMetadata.settlementDate) <= new Date();
        }
        return status === filterStatus;
      });
    }
    
    // Sort by date descending
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transfers, filterPeriod, filterAccount, filterStatus, categories]);
  
  // Calculate statistics
  const stats = useMemo(() => {
    const now = new Date();
    const last30Days = filteredTransfers.filter(t => 
      new Date(t.date) >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    );
    
    const totalVolume = filteredTransfers.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalFees = filteredTransfers.reduce((sum, t) => 
      sum + (t.transferMetadata?.fees || 0), 0
    );
    const pendingCount = filteredTransfers.filter(t => 
      t.transferMetadata?.reconciliationStatus === 'pending' || 
      !t.transferMetadata?.reconciliationStatus
    ).length;
    const avgAmount = filteredTransfers.length > 0 
      ? totalVolume / filteredTransfers.length 
      : 0;
    
    return {
      totalVolume,
      totalFees,
      pendingCount,
      avgAmount,
      last30DaysCount: last30Days.length,
      totalCount: filteredTransfers.length
    };
  }, [filteredTransfers]);
  
  // Get transfer status badge
  const getStatusBadge = (transfer: Transaction) => {
    const status = transfer.transferMetadata?.reconciliationStatus || 'pending';
    const settlementDate = transfer.transferMetadata?.settlementDate;
    
    if (status === 'matched' || status === 'resolved') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
          <CheckCircleIcon size={12} />
          Reconciled
        </span>
      );
    }
    
    if (status === 'discrepancy') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
          <AlertCircleIcon size={12} />
          Discrepancy
        </span>
      );
    }
    
    if (settlementDate && new Date(settlementDate) <= new Date()) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          <CheckCircleIcon size={12} />
          Settled
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
        <ClockIcon size={12} />
        Pending
      </span>
    );
  };
  
  // Get account names for display
  const getAccountName = (accountId: string) => {
    return accounts.find(a => a.id === accountId)?.name || 'Unknown Account';
  };
  
  const getTargetAccountFromCategory = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (category?.isTransferCategory && category.accountId) {
      return getAccountName(category.accountId);
    }
    return 'Unknown Account';
  };
  
  return (
    <PageWrapper
      title="Transfer Center"
      rightContent={
        <button
          onClick={() => {
            setSelectedTransfer(undefined);
            setShowTransferModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
        >
          <PlusIcon size={20} />
          New Transfer
        </button>
      }
    >
      {/* Statistics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Volume</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            ${stats.totalVolume.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.totalCount} transfers
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 dark:text-gray-400">Average Transfer</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            ${stats.avgAmount.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Per transaction
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Fees</div>
          <div className="text-2xl font-bold text-red-600">
            ${stats.totalFees.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Across all transfers
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600 dark:text-gray-400">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">
            {stats.pendingCount}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Awaiting reconciliation
          </div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <FilterIcon size={20} className="text-gray-400" />
            <span className="font-medium text-gray-700 dark:text-gray-300">Filters:</span>
          </div>
          
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value as 'all' | '30d' | '90d' | '1y')}
            className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
          >
            <option value="all">All Time</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>

          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
          >
            <option value="">All Accounts</option>
            {accounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'pending' | 'settled' | 'reconciled')}
            className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="settled">Settled</option>
            <option value="reconciled">Reconciled</option>
          </select>
          
          <div className="ml-auto text-sm text-gray-500">
            Showing {filteredTransfers.length} of {transfers.length} transfers
          </div>
        </div>
      </div>
      
      {/* Transfer List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-blue-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Transfer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <ArrowRightIcon size={48} className="text-gray-300" />
                      <div>No transfers found</div>
                      <button
                        onClick={() => setShowTransferModal(true)}
                        className="mt-2 text-primary hover:text-secondary font-medium"
                      >
                        Create your first transfer
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((transfer) => (
                  <tr key={transfer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {format(new Date(transfer.date), 'MMM dd, yyyy')}
                      {transfer.transferMetadata?.settlementDate && (
                        <div className="text-xs text-gray-500">
                          Settles: {format(new Date(transfer.transferMetadata.settlementDate), 'MMM dd')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {getAccountName(transfer.accountId)}
                        </span>
                        <ArrowRightIcon size={16} className="text-gray-400" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {getTargetAccountFromCategory(transfer.category)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      <div>{transfer.description}</div>
                      {transfer.transferMetadata?.transferPurpose && (
                        <div className="text-xs text-gray-500">
                          {transfer.transferMetadata.transferPurpose}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="font-medium text-gray-900 dark:text-white">
                        ${Math.abs(transfer.amount).toLocaleString()}
                      </div>
                      {transfer.transferMetadata?.fees && (
                        <div className="text-xs text-red-600">
                          Fee: ${transfer.transferMetadata.fees.toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <span className="capitalize">
                        {transfer.transferMetadata?.transferType?.replace('_', ' ') || 'Internal'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(transfer)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => {
                          setSelectedTransfer(transfer);
                          setShowTransferModal(true);
                        }}
                        className="text-primary hover:text-secondary font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Transfer Modal */}
      <EnhancedTransferModal
        isOpen={showTransferModal}
        onClose={() => {
          setShowTransferModal(false);
          setSelectedTransfer(undefined);
        }}
        {...(selectedTransfer ? { transaction: selectedTransfer } : {})}
      />
    </PageWrapper>
  );
}
