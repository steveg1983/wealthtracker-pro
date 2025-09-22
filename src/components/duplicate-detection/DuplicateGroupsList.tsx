import { memo, useEffect } from 'react';
import { CalendarIcon, DollarSignIcon, FileTextIcon } from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { DuplicateGroup } from '../../services/duplicateDetectionService';
import { duplicateDetectionService } from '../../services/duplicateDetectionService';
import { useLogger } from '../services/ServiceProvider';

interface DuplicateGroupsListProps {
  groups: DuplicateGroup[];
  selectedDuplicates: Set<string>;
  isImport: boolean;
  onToggleDuplicate: (id: string) => void;
}

/**
 * Duplicate groups list component
 * Displays detected duplicate transaction groups
 */
export const DuplicateGroupsList = memo(function DuplicateGroupsList({ groups,
  selectedDuplicates,
  isImport,
  onToggleDuplicate
 }: DuplicateGroupsListProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('DuplicateGroupsList component initialized', {
      componentName: 'DuplicateGroupsList'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();
  const formatForList = (amount: number | string) => formatCurrency(typeof amount === 'string' ? parseFloat(amount) : amount);

  return (
    <div className="space-y-4 max-h-96 overflow-y-auto">
      {groups.map((group, index) => (
        <DuplicateGroupCard
          key={index}
          group={group}
          isSelected={selectedDuplicates.has(group.original.id)}
          isImport={isImport}
          formatCurrency={formatForList}
          onToggle={() => onToggleDuplicate(group.original.id)}
          onTogglePotential={onToggleDuplicate}
          selectedDuplicates={selectedDuplicates}
        />
      ))}
    </div>
  );
});

// Sub-component for individual duplicate group
interface DuplicateGroupCardProps {
  group: DuplicateGroup;
  isSelected: boolean;
  isImport: boolean;
  formatCurrency: (amount: number | string) => string;
  onToggle: () => void;
  onTogglePotential: (id: string) => void;
  selectedDuplicates: Set<string>;
}

const DuplicateGroupCard = memo(function DuplicateGroupCard({
  group,
  isSelected,
  isImport,
  formatCurrency,
  onToggle,
  onTogglePotential,
  selectedDuplicates
}: DuplicateGroupCardProps) {
  const logger = useLogger();
  const getDate = (date: Date | string) => {
    return (date instanceof Date ? date : new Date(date)).toLocaleDateString();
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {isImport && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggle}
              className="mt-1"
            />
          )}
          <div>
            <div className="font-medium">{group.original.description}</div>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
              <span className="flex items-center gap-1">
                <CalendarIcon size={14} />
                {getDate(group.original.date)}
              </span>
              <span className="flex items-center gap-1">
                <DollarSignIcon size={14} />
                {formatCurrency(group.original.amount)}
              </span>
              <span className="flex items-center gap-1">
                <FileTextIcon size={14} />
                {group.original.category}
              </span>
            </div>
          </div>
        </div>
        <div className={`text-sm font-medium ${duplicateDetectionService.getConfidenceColor(group.confidence)}`}>
          {Math.round(group.confidence)}% match
        </div>
      </div>

      <div className="ml-7 space-y-2">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {duplicateDetectionService.getConfidenceLabel(group.confidence)} with:
        </div>
        {group.potential.map(transaction => (
          <PotentialDuplicateRow
            key={transaction.id}
            transaction={transaction}
            original={group.original}
            isImport={isImport}
            isSelected={selectedDuplicates.has(transaction.id)}
            formatCurrency={formatCurrency}
            onToggle={() => onTogglePotential(transaction.id)}
          />
        ))}
      </div>
    </div>
  );
});

// Sub-component for potential duplicate row
interface PotentialDuplicateRowProps {
  transaction: unknown;
  original: unknown;
  isImport: boolean;
  isSelected: boolean;
  formatCurrency: (amount: number | string) => string;
  onToggle: () => void;
}

const PotentialDuplicateRow = memo(function PotentialDuplicateRow({
  transaction,
  original,
  isImport,
  isSelected,
  formatCurrency,
  onToggle
}: PotentialDuplicateRowProps) {
  const logger = useLogger();
  const t = transaction as { id: string; description: string; date: Date | string; amount: number | string; category: string };
  const getDate = (date: Date | string) => {
    return (date instanceof Date ? date : new Date(date)).toLocaleDateString();
  };

  const originalTransaction = original as { description?: string };
  const similarity = duplicateDetectionService.calculateSimilarity(
    originalTransaction.description || '',
    t.description || ''
  );

  return (
    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded p-2">
      <div className="flex items-center gap-3">
        {!isImport && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
          />
        )}
        <div>
          <div className="text-sm font-medium">{t.description}</div>
          <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
            <span>{getDate(t.date)}</span>
            <span>{formatCurrency(t.amount)}</span>
            <span>{t.category}</span>
          </div>
        </div>
      </div>
      <div className="text-xs text-gray-500">
        {similarity.toFixed(0)}% similar
      </div>
    </div>
  );
});
