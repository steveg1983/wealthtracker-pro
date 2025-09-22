import React, { useEffect, memo } from 'react';
import { EditIcon, DeleteIcon, SettingsIcon, PieChartIcon, CheckCircleIcon } from '../icons';
import { IconButton } from '../icons/IconButton';
import type { Account } from '../../types';
import { useLogger } from '../services/ServiceProvider';

interface AccountCardProps {
  account: Account;
  isEditing: boolean;
  editBalance: string;
  investmentSummary: any;
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
}

const AccountCard = memo(function AccountCard({ account,
  isEditing,
  editBalance,
  investmentSummary,
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
  formatLastUpdated
 }: AccountCardProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('AccountCard component initialized', {
      componentName: 'AccountCard'
    });
  }, []);

  return (
    <div 
      className="p-3 sm:p-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 hover:shadow-xl hover:border-blue-200/50 transition-all duration-300 cursor-pointer"
      onClick={(e) => onNavigate(account.id, e)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <AccountInfo 
          account={account}
          investmentSummary={investmentSummary}
          formatCurrency={formatCurrency}
          formatLastUpdated={formatLastUpdated}
        />
        
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3">
          {isEditing ? (
            <EditingControls
              editBalance={editBalance}
              onSave={() => onSaveEdit(account.id)}
              onCancel={onCancelEdit}
              setEditBalance={setEditBalance}
            />
          ) : (
            <AccountActions
              account={account}
              investmentSummary={investmentSummary}
              onEdit={() => onEdit(account.id, account.balance)}
              onDelete={() => onDelete(account.id)}
              onOpenReconcile={() => onOpenReconcile(account.id)}
              onOpenSettings={() => onOpenSettings(account.id)}
              onOpenPortfolio={() => onOpenPortfolio(account.id)}
              formatCurrency={formatCurrency}
            />
          )}
        </div>
      </div>
    </div>
  );
});

// Account Info Sub-component
const AccountInfo = memo(function AccountInfo({
  account,
  investmentSummary,
  formatCurrency,
  formatLastUpdated
}: any): React.JSX.Element {
  const logger = useLogger();
  return (
    <div className="flex-1 min-w-0">
      <h3 className="text-base md:text-lg font-medium text-gray-900 dark:text-white hover:text-gray-600 dark:hover:text-gray-500 transition-colors">
        {account.name}
      </h3>
      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
        {account.institution || 'Unknown Institution'}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-300">
        Last updated: {formatLastUpdated(account.lastUpdated)}
      </p>
      {account.openingBalance !== undefined && (
        <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
          Opening balance: {formatCurrency(account.openingBalance, account.currency)} 
          {account.openingBalanceDate && ` on ${formatLastUpdated(account.openingBalanceDate)}`}
        </p>
      )}
      {investmentSummary && (
        <div className="text-xs text-gray-500 dark:text-gray-300 mt-1 space-y-1">
          <p>Cash Balance: {formatCurrency(investmentSummary.cashBalance, account.currency)}</p>
          <p>Holdings Value: {formatCurrency(investmentSummary.holdingsValue, account.currency)} ({investmentSummary.positionCount} positions)</p>
          <p className="font-medium">Total Value: {formatCurrency(investmentSummary.totalValue, account.currency)}</p>
        </div>
      )}
    </div>
  );
});

// Editing Controls Sub-component
const EditingControls = memo(function EditingControls({
  editBalance,
  onSave,
  onCancel,
  setEditBalance
}: any): React.JSX.Element {
  const logger = useLogger();
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        step="0.01"
        value={editBalance}
        onChange={(e) => setEditBalance(e.target.value)}
        className="w-24 sm:w-32 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
        autoFocus
      />
      <button
        onClick={onSave}
        className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
      >
        Save
      </button>
      <button
        onClick={onCancel}
        className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
      >
        Cancel
      </button>
    </div>
  );
});

// Account Actions Sub-component
const AccountActions = memo(function AccountActions({
  account,
  investmentSummary,
  onEdit,
  onDelete,
  onOpenReconcile,
  onOpenSettings,
  onOpenPortfolio,
  formatCurrency
}: any): React.JSX.Element {
  const logger = useLogger();
  return (
    <>
      <div className="flex items-center gap-3">
        <p className="text-lg md:text-xl font-semibold tabular-nums whitespace-nowrap text-gray-900 dark:text-white">
          {formatCurrency(account.balance, account.currency)}
        </p>
        <div className="flex items-center gap-1">
          {investmentSummary && (
            <ActionButton
              onClick={onOpenPortfolio}
              icon={<PieChartIcon size={16} />}
              tooltip="View Portfolio"
              className="text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-200 hover:bg-purple-100/50 dark:hover:bg-purple-900/30"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <ActionButton
            onClick={onOpenSettings}
            icon={<SettingsIcon size={20} />}
            tooltip="Settings"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            useIconButton
          />
          <ActionButton
            onClick={onOpenReconcile}
            icon={<CheckCircleIcon size={20} />}
            tooltip="Reconcile"
            className="text-gray-500 hover:text-blue-700 dark:text-gray-500 dark:hover:text-blue-200 hover:bg-blue-100/50 dark:hover:bg-blue-900/30"
          />
          <ActionButton
            onClick={onEdit}
            icon={<EditIcon size={20} />}
            tooltip="Adjust"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            useIconButton
          />
          <ActionButton
            onClick={onDelete}
            icon={<DeleteIcon size={20} />}
            tooltip="Delete"
            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-100/50 dark:hover:bg-red-900/30"
            useIconButton
            tooltipAlign="right"
          />
        </div>
      </div>
    </>
  );
});

// Action Button Sub-component
const ActionButton = memo(function ActionButton({
  onClick,
  icon,
  tooltip,
  className,
  useIconButton = false,
  tooltipAlign = 'center'
}: any): React.JSX.Element {
  const logger = useLogger();
  if (useIconButton) {
    return (
      <div className="relative group">
        <IconButton
          onClick={onClick}
          icon={icon}
          variant="ghost"
          size="md"
          className={`${className} min-w-[48px] min-h-[48px]`}
          title={tooltip}
        />
        <Tooltip text={tooltip} align={tooltipAlign} />
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-all duration-200 relative group backdrop-blur-sm ${className}`}
      title={tooltip}
    >
      {icon}
      <Tooltip text={tooltip} align={tooltipAlign} />
    </button>
  );
});

// Tooltip Sub-component
const Tooltip = memo(function Tooltip({ text, align = 'center' }: any): React.JSX.Element {
  const logger = useLogger();
  const alignmentClass = align === 'right' ? 'right-0' : 'left-1/2 transform -translate-x-1/2';
  
  return (
    <span className={`absolute bottom-full ${alignmentClass} mb-2 px-3 py-1.5 text-xs text-white bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg border border-white/10`}>
      {text}
    </span>
  );
});

export default AccountCard;