import React from 'react';
import { Modal } from './common/Modal';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import type { JsonValue } from '../types/common';
import { 
  CheckCircleIcon, 
  ArrowRightIcon, 
  UndoIcon, 
  CalendarIcon,
  TagIcon,
  DollarSignIcon,
  FileTextIcon,
  AlertTriangleIcon,
  AlertCircleIcon
} from './icons';

export type ChangeRecord = {
  id: string;
  type: 'transaction' | 'account';
  itemId: string;
  field: string;
  oldValue: JsonValue;
  newValue: JsonValue;
  description: string;
  issueType: string;
};

interface FixSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  changes: ChangeRecord[];
  onUndo: (changeId: string) => void;
  onUndoAll: () => void;
}

function FixSummaryModal({
  isOpen,
  onClose,
  changes,
  onUndo,
  onUndoAll
}: FixSummaryModalProps) {
  const { formatCurrency } = useCurrencyDecimal();

  const getFieldIcon = (field: string) => {
    switch (field) {
      case 'date':
        return <CalendarIcon size={16} className="text-gray-500" />;
      case 'category':
        return <TagIcon size={16} className="text-gray-500" />;
      case 'amount':
      case 'balance':
        return <DollarSignIcon size={16} className="text-gray-500" />;
      case 'description':
        return <FileTextIcon size={16} className="text-gray-500" />;
      default:
        return null;
    }
  };

  const formatValue = (value: JsonValue, field: string) => {
    if (field === 'date' && value instanceof Date) {
      return value.toLocaleDateString();
    }
    if ((field === 'amount' || field === 'balance') && typeof value === 'number') {
      return formatCurrency(value);
    }
    if (value === null || value === undefined || value === '') {
      return '(empty)';
    }
    return String(value);
  };

  const getIssueTypeColor = (issueType: string) => {
    if (issueType.includes('error')) return 'text-red-600 bg-red-50 dark:bg-red-900/20';
    if (issueType.includes('warning')) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
    return 'text-gray-600 bg-blue-50 dark:bg-gray-900/20';
  };

  const groupedChanges = changes.reduce((acc, change) => {
    if (!acc[change.issueType]) {
      acc[change.issueType] = [];
    }
    acc[change.issueType].push(change);
    return acc;
  }, {} as Record<string, ChangeRecord[]>);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Fix Summary - What We Changed"
    >
      <div className="p-6">
        {/* Summary Header */}
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="text-green-600 dark:text-green-400" size={24} />
            <div>
              <h3 className="font-medium text-green-900 dark:text-green-100">
                Successfully Applied {changes.length} Fix{changes.length !== 1 ? 'es' : ''}
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Review the changes below. You can undo individual fixes or all changes at once.
              </p>
            </div>
          </div>
        </div>

        {/* Undo All Button */}
        {changes.length > 0 && (
          <div className="flex justify-end mb-4">
            <button
              onClick={onUndoAll}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white 
                       rounded-lg hover:bg-red-700 transition-colors"
            >
              <UndoIcon size={16} />
              Undo All Changes
            </button>
          </div>
        )}

        {/* Changes List */}
        <div className="space-y-6 max-h-96 overflow-y-auto">
          {Object.entries(groupedChanges).map(([issueType, issueChanges]) => (
            <div key={issueType}>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs ${getIssueTypeColor(issueType)}`}>
                  {issueType}
                </span>
                <span className="text-sm text-gray-500">({issueChanges.length} changes)</span>
              </h4>
              
              <div className="space-y-3">
                {issueChanges.map((change) => (
                  <div
                    key={change.id}
                    className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                          {change.description}
                        </div>
                        
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex items-center gap-2">
                            {getFieldIcon(change.field)}
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {change.field === 'balance' ? 'Account Balance' : 
                               change.field === 'date' ? 'Transaction Date' :
                               change.field === 'category' ? 'Category' :
                               change.field === 'description' ? 'Description' :
                               change.field === 'deleted' ? 'Status' :
                               change.field}:
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3 flex-1">
                            <span className="text-sm text-red-600 dark:text-red-400 line-through">
                              {formatValue(change.oldValue, change.field)}
                            </span>
                            
                            <ArrowRightIcon size={16} className="text-gray-400 flex-shrink-0" />
                            
                            <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                              {formatValue(change.newValue, change.field)}
                            </span>
                          </div>
                        </div>
                        
                        {change.type === 'account' && change.field === 'balance' && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 bg-blue-50 dark:bg-gray-900/20 px-2 py-1 rounded">
                            ℹ️ The account balance has been updated to match the sum of all transactions in this account
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={() => onUndo(change.id)}
                        className="ml-4 flex items-center gap-1 px-3 py-1 text-sm text-red-600 
                                 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Undo this change"
                      >
                        <UndoIcon size={14} />
                        Undo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {changes.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <AlertTriangleIcon className="mx-auto mb-3" size={48} />
            <p>No changes to display</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {changes.some(c => c.field === 'created') && (
            <p className="flex items-center gap-2">
              <AlertCircleIcon size={16} />
              New transactions may not appear until you navigate to the account
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 
                   dark:hover:bg-gray-700 rounded-lg"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

export default FixSummaryModal;