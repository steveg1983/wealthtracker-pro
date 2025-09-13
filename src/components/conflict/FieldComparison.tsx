/**
 * Field Comparison Component
 * Displays field-by-field comparison for conflict resolution
 */

import React, { useEffect } from 'react';
import { formatCurrency } from '../../utils/formatters';
import { format } from 'date-fns';
import { logger } from '../../services/loggingService';

interface FieldComparisonProps {
  userFields: string[];
  clientData: Record<string, any>;
  serverData: Record<string, any>;
  mergedData?: Record<string, any>;
  fieldStatus: Map<string, { isDifferent: boolean; isConflicting: boolean }>;
  fieldSelections: Record<string, 'client' | 'server'>;
  selectedResolution: 'client' | 'server' | 'merge';
  showAdvanced: boolean;
  onToggleField: (field: string) => void;
  getFieldMetadata: (field: string) => { displayName: string; type: string };
}

const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M7 11L6 8l-3-1 3-1 1-3 1 3 3 1-3 1-1 3zm5 8l-1-2.5L8.5 15l2.5-1 1-2.5 1 2.5 2.5 1-2.5 1.5L12 19zm7-15l-1 3-3 1 3 1 1 3 1-3 3-1-3-1-1-3z"/>
  </svg>
);

const FieldComparison = React.memo(({
  userFields,
  clientData,
  serverData,
  mergedData,
  fieldStatus,
  fieldSelections,
  selectedResolution,
  showAdvanced,
  onToggleField,
  getFieldMetadata
}: FieldComparisonProps) => {
  
  const formatFieldValue = (field: string, value: unknown): string => {
    if (value == null) return '(empty)';
    
    const metadata = getFieldMetadata(field);
    
    switch (metadata.type) {
      case 'currency':
        return formatCurrency(typeof value === 'number' ? value : Number(value));
      case 'date':
        return format(new Date(typeof value === 'string' || typeof value === 'number' ? value : String(value)), 'PP');
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'array':
        return Array.isArray(value) ? value.join(', ') || '(none)' : String(value);
      default:
        return String(value);
    }
  };

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {userFields.map(field => {
        const clientValue = clientData?.[field];
        const serverValue = serverData?.[field];
        const status = fieldStatus.get(field) || { isDifferent: false, isConflicting: false };
        const metadata = getFieldMetadata(field);
        
        // Get the current selection for this field
        const currentSelection = fieldSelections[field] || 
          (mergedData?.[field] === clientValue ? 'client' : 'server');

        return (
          <div 
            key={field}
            className={`border rounded-lg p-3 ${
              status.isDifferent 
                ? status.isConflicting 
                  ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20' 
                  : 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm text-gray-900 dark:text-white">
                {metadata.displayName}
              </span>
              {status.isDifferent && (
                <div className="flex items-center gap-2">
                  {status.isConflicting ? (
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
                      className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Use {currentSelection === 'client' ? 'Server' : 'Your'} Version
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className={`p-2 rounded ${
                currentSelection === 'client' && status.isDifferent
                  ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-400'
                  : 'bg-gray-50 dark:bg-gray-800'
              }`}>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Your Version</div>
                <div className="font-mono text-xs text-gray-900 dark:text-white">
                  {formatFieldValue(field, clientValue)}
                </div>
              </div>
              
              <div className={`p-2 rounded ${
                currentSelection === 'server' && status.isDifferent
                  ? 'bg-green-100 dark:bg-green-900/30 ring-2 ring-green-400'
                  : 'bg-gray-50 dark:bg-gray-800'
              }`}>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Server Version</div>
                <div className="font-mono text-xs text-gray-900 dark:text-white">
                  {formatFieldValue(field, serverValue)}
                </div>
              </div>
            </div>

            {selectedResolution === 'merge' && mergedData && status.isDifferent && (
              <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                <div className="text-xs text-purple-700 dark:text-purple-300 mb-1 flex items-center gap-1">
                  <SparklesIcon className="h-3 w-3" />
                  Smart Merge Result:
                </div>
                <div className="font-mono text-xs text-purple-900 dark:text-purple-100">
                  {formatFieldValue(field, mergedData[field])}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

FieldComparison.displayName = 'FieldComparison';

export default FieldComparison;
