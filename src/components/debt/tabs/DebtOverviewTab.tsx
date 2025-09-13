import React, { useEffect } from 'react';
import { CreditCardIcon, PlusIcon } from '../../icons';
import { DebtCard } from '../display/DebtCard';
import type { Debt, PayoffProjection } from '../../DebtManagement';
import type { Account } from '../../../types';
import { logger } from '../../../services/loggingService';

interface DebtOverviewTabProps {
  debts: Debt[];
  accounts: Account[];
  projections: PayoffProjection[];
  formatCurrency: (value: number) => string;
  onEditDebt: (debtId: string) => void;
  onAddDebt: () => void;
}

export function DebtOverviewTab({ 
  debts, 
  accounts, 
  projections, 
  formatCurrency, 
  onEditDebt, 
  onAddDebt 
}: DebtOverviewTabProps): React.JSX.Element {
  const activeDebts = debts.filter(d => d.isActive);

  if (activeDebts.length === 0) {
    return (
      <div className="col-span-full text-center py-12">
        <CreditCardIcon className="mx-auto text-gray-400 mb-4" size={48} />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No debts tracked
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Add your debts to start tracking and planning your payoff strategy
        </p>
        <button
          onClick={onAddDebt}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
        >
          <PlusIcon size={16} />
          Add Your First Debt
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {activeDebts.map(debt => (
        <DebtCard
          key={debt.id}
          debt={debt}
          account={accounts.find(a => a.id === debt.accountId)}
          projection={projections.find(p => p.debtId === debt.id)}
          formatCurrency={formatCurrency}
          onEdit={onEditDebt}
        />
      ))}
    </div>
  );
}