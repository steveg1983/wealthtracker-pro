/**
 * Field Comparison Component
 * Displays field-by-field differences between client and server data
 */

import React, { useEffect, memo } from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { format } from 'date-fns';
import { SparklesIcon } from '../../icons';
import type { ConflictAnalysis } from '../../../services/conflictResolutionService';
import { useLogger } from '../services/ServiceProvider';

interface FieldComparisonProps {
  field: string;
  clientValue: any;
  serverValue: any;
  analysis: ConflictAnalysis;
  currentSelection: 'client' | 'server';
  showAdvanced: boolean;
  selectedResolution: 'client' | 'server' | 'merge';
  onToggleField: (field: string) => void;
}

export const FieldComparison = memo(function FieldComparison({ field,
  clientValue,
  serverValue,
  analysis,
  currentSelection,
  showAdvanced,
  selectedResolution,
  onToggleField
 }: FieldComparisonProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('FieldComparison component initialized', {
      componentName: 'FieldComparison'
    });
  }, []);
  const isDifferent = clientValue !== serverValue;
  const isConflicting = analysis.conflictingFields.includes(field);

  const formatFieldValue = (fieldName: string, value: unknown): string => {
    if (value == null) return '(empty)';
    
    if (fieldName.includes('amount') || fieldName.includes('balance') || fieldName === 'spent') {
      return formatCurrency(typeof value === 'number' ? value : Number(value) || 0);
    }
    
    if (fieldName.includes('date') || fieldName.includes('_at')) {
      return format(new Date(value as string), 'PP');
    }
    
    if (Array.isArray(value)) {
      return value.join(', ') || '(none)';
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    return String(value);
  };

  return (
    <div 
      className={`border rounded-lg p-3 ${
        isDifferent 
          ? isConflicting 
            ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20' 
            : 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-gray-900/20'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm capitalize">
          {field.replace(/_/g, ' ')}
        </span>
        {isDifferent && (
          <div className="flex items-center gap-2">
            {isConflicting ? (
              <span className="text-xs px-2 py-1 bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200 rounded">
                Conflict
              </span>
            ) : (
              <span className="text-xs px-2 py-1 bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200 rounded">
                Compatible
              </span>
            )}
            {showAdvanced && (
              <button
                onClick={() => onToggleField(field)}
                className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Use {currentSelection === 'client' ? 'Server' : 'Your'} Version
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className={`p-2 rounded ${
          currentSelection === 'client' && isDifferent
            ? 'bg-blue-100 dark:bg-gray-900/30 ring-2 ring-blue-400'
            : 'bg-gray-50 dark:bg-gray-800'
        }`}>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Your Version</div>
          <div className="font-mono text-xs">
            {formatFieldValue(field, clientValue)}
          </div>
        </div>
        
        <div className={`p-2 rounded ${
          currentSelection === 'server' && isDifferent
            ? 'bg-green-100 dark:bg-green-900/30 ring-2 ring-green-400'
            : 'bg-gray-50 dark:bg-gray-800'
        }`}>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Server Version</div>
          <div className="font-mono text-xs">
            {formatFieldValue(field, serverValue)}
          </div>
        </div>
      </div>

      {selectedResolution === 'merge' && analysis.mergedData && isDifferent && (
        <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
          <div className="text-xs text-purple-700 dark:text-purple-300 mb-1 flex items-center gap-1">
            <SparklesIcon size={12} />
            Smart Merge Result:
          </div>
          <div className="font-mono text-xs">
            {formatFieldValue(field, analysis.mergedData[field])}
          </div>
        </div>
      )}
    </div>
  );
});