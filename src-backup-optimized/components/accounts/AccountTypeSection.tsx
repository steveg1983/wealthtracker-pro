import React, { useEffect, memo } from 'react';
import AccountCard from './AccountCard';
import type { Account } from '../../types';
import type { DecimalInstance } from '../../types/decimal-types';
import { useLogger } from '../services/ServiceProvider';

interface AccountTypeSectionProps {
  type: string;
  title: string;
  icon: any;
  color: string;
  accounts: Account[];
  typeTotal: DecimalInstance;
  editingId: string | null;
  editBalance: string;
  onEdit: (accountId: string, currentBalance: number) => void;
  onSaveEdit: (accountId: string) => void;
  onCancelEdit: () => void;
  onDelete: (accountId: string) => void;
  onNavigate: (accountId: string, event: React.MouseEvent) => void;
  onOpenReconcile: (accountId: string) => void;
  onOpenSettings: (accountId: string) => void;
  onOpenPortfolio: (accountId: string) => void;
  setEditBalance: (value: string) => void;
  formatCurrency: (amount: any, currency?: string) => string;
  formatLastUpdated: (date: Date | string) => string;
  getInvestmentSummary: (account: Account) => any;
}

const AccountTypeSection = memo(function AccountTypeSection({ type,
  title,
  icon: Icon,
  color,
  accounts,
  typeTotal,
  editingId,
  editBalance,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onNavigate,
  onOpenReconcile,
  onOpenSettings,
  onOpenPortfolio,
  setEditBalance,
  formatCurrency,
  formatLastUpdated,
  getInvestmentSummary
 }: AccountTypeSectionProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('AccountTypeSection component initialized', {
      componentName: 'AccountTypeSection'
    });
  }, []);
  if (accounts.length === 0) return null;

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-gray-800/50 dark:to-gray-700/50 backdrop-blur-sm border-b border-blue-200/50 dark:border-gray-600/50 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3">
            <Icon className={color} size={20} />
            <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
            <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
              ({accounts.length} {accounts.length === 1 ? 'account' : 'accounts'})
            </span>
          </div>
          <p className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
            {formatCurrency(typeTotal)}
          </p>
        </div>
      </div>

      <div className="p-3 sm:p-4 space-y-3">
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            isEditing={editingId === account.id}
            editBalance={editBalance}
            investmentSummary={getInvestmentSummary(account)}
            onEdit={onEdit}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            onDelete={onDelete}
            onNavigate={onNavigate}
            onOpenReconcile={onOpenReconcile}
            onOpenSettings={onOpenSettings}
            onOpenPortfolio={onOpenPortfolio}
            setEditBalance={setEditBalance}
            formatCurrency={formatCurrency}
            formatLastUpdated={formatLastUpdated}
          />
        ))}
      </div>
    </div>
  );
});

export default AccountTypeSection;
