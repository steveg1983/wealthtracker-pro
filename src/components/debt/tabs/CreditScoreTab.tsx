import React, { useEffect } from 'react';
import { PlusIcon } from '../../icons';
import { CreditScoreHistory } from '../display/CreditScoreHistory';
import type { CreditScoreEntry } from '../../DebtManagement';
import { useLogger } from '../services/ServiceProvider';

interface CreditScoreTabProps {
  creditScores: CreditScoreEntry[];
  onAddScore: () => void;
}

export function CreditScoreTab({ creditScores, onAddScore  }: CreditScoreTabProps): React.JSX.Element {
  const logger = useLogger();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Credit Score Tracking
        </h3>
        <button
          onClick={onAddScore}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
        >
          <PlusIcon size={16} />
          Add Score
        </button>
      </div>

      <CreditScoreHistory 
        creditScores={creditScores} 
        onAddScore={onAddScore}
      />
    </div>
  );
}