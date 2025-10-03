import React, { useEffect, memo } from 'react';
import {
  EditIcon,
  DeleteIcon,
  PlayIcon,
  StopIcon,
  BellIcon,
  DollarSignIcon,
  CreditCardIcon,
  TargetIcon,
  TrendingUpIcon
} from '../icons';
import type { NotificationRule } from './types';
import { useLogger } from '../services/ServiceProvider';

interface RuleItemProps {
  rule: NotificationRule;
  style: React.CSSProperties;
  onToggle: (ruleId: string, enabled: boolean) => void;
  onEdit: (rule: NotificationRule) => void;
  onDelete: (ruleId: string) => void;
  formatTime: (date: Date) => string;
}

const getRuleTypeIcon = (type: string): React.JSX.Element => {
  switch (type) {
    case 'budget': return <DollarSignIcon size={16} className="text-green-600" />;
    case 'transaction': return <CreditCardIcon size={16} className="text-gray-600" />;
    case 'goal': return <TargetIcon size={16} className="text-purple-600" />;
    case 'account': return <TrendingUpIcon size={16} className="text-orange-600" />;
    default: return <BellIcon size={16} className="text-gray-600" />;
  }
};

export const RuleItem = memo(function RuleItem({ rule,
  style,
  onToggle,
  onEdit,
  onDelete,
  formatTime
 }: RuleItemProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('RuleItem component initialized', {
      componentName: 'RuleItem'
    });
  }, []);

  return (
    <div
      style={style}
      className="p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1">{getRuleTypeIcon(rule.type)}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900 dark:text-white">
                {rule.name}
              </h4>
              <span className={`px-2 py-1 text-xs rounded-full ${
                rule.enabled
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300'
              }`}>
                {rule.enabled ? 'Active' : 'Inactive'}
              </span>
              <span className={`px-2 py-1 text-xs rounded-full ${
                rule.priority === 'urgent' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                rule.priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400' :
                rule.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                'bg-blue-100 text-blue-800 dark:bg-gray-900/20 dark:text-gray-500'
              }`}>
                {rule.priority}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {rule.conditions.map(c => c.description).join(', ')}
            </p>
            {rule.lastTriggered && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                Last triggered: {formatTime(rule.lastTriggered)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(rule.id, !rule.enabled)}
            className={`p-2 rounded-lg ${
              rule.enabled
                ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
            title={rule.enabled ? 'Disable rule' : 'Enable rule'}
          >
            {rule.enabled ? <PlayIcon size={16} /> : <StopIcon size={16} />}
          </button>
          <button
            onClick={() => onEdit(rule)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg"
            title="Edit rule"
          >
            <EditIcon size={16} />
          </button>
          <button
            onClick={() => onDelete(rule.id)}
            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
            title="Delete rule"
          >
            <DeleteIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
});