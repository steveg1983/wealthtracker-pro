/**
 * Enhanced Conflict Resolution Modal with Field-Level Merging
 * Shows intelligent merge suggestions and allows field-by-field resolution
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { AlertTriangleIcon, CheckIcon, MergeIcon } from '../icons';
import { formatCurrency } from '../../utils/formatters';
import { format } from 'date-fns';
import { ConflictResolutionService } from '../../services/conflictResolutionService';
import type { ConflictAnalysis } from '../../services/conflictResolutionService';
import type { EntityType } from '../../types/sync-types';
import type { ConflictRecordType } from '../../hooks/useConflictResolution';
import { logger } from '../../services/loggingService';
import { normalizeConflictValue } from '../../utils/conflictNormalization';

type ConflictValue = ConflictRecordType['clientData'];

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDateValue = (value: unknown): string => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return format(value, 'PP');
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return format(parsed, 'PP');
    }
  }

  return 'Unknown date';
};

interface EnhancedConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: ConflictRecordType | null;
  analysis?: ConflictAnalysis;
  onResolve: (resolution: 'client' | 'server' | 'merge', mergedData?: ConflictValue) => Promise<void> | void;
}

export const EnhancedConflictResolutionModal: React.FC<EnhancedConflictResolutionModalProps> = ({
  isOpen,
  onClose,
  conflict,
  analysis: providedAnalysis,
  onResolve
}) => {
  const [selectedResolution, setSelectedResolution] = useState<'client' | 'server' | 'merge'>('merge');
  const [fieldSelections, setFieldSelections] = useState<Record<string, 'client' | 'server'>>({});
  const [isResolving, setIsResolving] = useState(false);
  const [analysis, setAnalysis] = useState<ConflictAnalysis | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (conflict && !providedAnalysis) {
      // Analyze conflict if not provided
      const newAnalysis = ConflictResolutionService.analyzeConflict(
        conflict.entity,
        conflict.clientDataRaw ?? conflict.clientData,
        conflict.serverDataRaw ?? conflict.serverData,
        conflict.clientTimestamp || Date.now(),
        conflict.serverTimestamp || Date.now()
      );
      setAnalysis(newAnalysis);
      
      // Set default resolution based on analysis
      if (newAnalysis.canAutoResolve && newAnalysis.mergedData) {
        setSelectedResolution('merge');
      } else {
        setSelectedResolution(newAnalysis.suggestedResolution === 'client' ? 'client' : 'server');
      }
    } else if (providedAnalysis) {
      setAnalysis(providedAnalysis);
      
      if (providedAnalysis.canAutoResolve && providedAnalysis.mergedData) {
        setSelectedResolution('merge');
      }
    }
  }, [conflict, providedAnalysis]);

  const mergedNormalized = useMemo<Record<string, unknown> | null>(() => {
    if (!analysis?.mergedData) {
      return null;
    }
    return normalizeConflictValue<EntityType>(analysis.mergedData).normalized;
  }, [analysis?.mergedData]);

  if (!conflict || !analysis) return null;

  const handleResolve = async () => {
    setIsResolving(true);
    
    try {
      if (selectedResolution === 'merge') {
        let resolvedNormalized: ConflictValue;

        if (showAdvanced && Object.keys(fieldSelections).length > 0) {
          // Custom field-by-field merge
          resolvedNormalized = { ...conflict.serverData };
          
          for (const [field, source] of Object.entries(fieldSelections)) {
            resolvedNormalized[field] = source === 'client' 
              ? conflict.clientData[field] 
              : conflict.serverData[field];
          }
        } else {
          // Use auto-merged data
          resolvedNormalized = mergedNormalized ? { ...mergedNormalized } : { ...conflict.serverData };
        }

        await onResolve(selectedResolution, resolvedNormalized);
        onClose();
        return;
      }

      if (selectedResolution === 'client') {
        await onResolve(selectedResolution, conflict.clientData);
      } else {
        await onResolve(selectedResolution, conflict.serverData);
      }
      
      onClose();
    } catch (error) {
      logger.error('Failed to resolve conflict:', error);
    } finally {
      setIsResolving(false);
    }
  };

  const toggleFieldSelection = (field: string) => {
    setFieldSelections(prev => ({
      ...prev,
      [field]: prev[field] === 'client' ? 'server' : 'client'
    }));
  };

  const renderFieldComparison = () => {
    const allFields = new Set([
      ...Object.keys(conflict.clientData || {}),
      ...Object.keys(conflict.serverData || {})
    ]);

    // Skip system fields
    const userFields = Array.from(allFields).filter(field => 
      !['id', 'user_id', 'created_at', 'updated_at', 'sync_version'].includes(field)
    );

    return (
      <div className="space-y-2">
        {userFields.map(field => {
          const clientValue = conflict.clientData?.[field];
          const serverValue = conflict.serverData?.[field];
          const isDifferent = clientValue !== serverValue;
          const isConflicting = analysis.conflictingFields.includes(field);
          
          // Get the current selection for this field
          const hasMergedValue = mergedNormalized ? Object.prototype.hasOwnProperty.call(mergedNormalized, field) : false;
          const mergedValue = hasMergedValue && mergedNormalized ? mergedNormalized[field] : undefined;
          const defaultSelection = hasMergedValue && mergedValue === clientValue ? 'client' : 'server';
          const currentSelection = fieldSelections[field] ?? defaultSelection;

          return (
            <div 
              key={field}
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
                        onClick={() => toggleFieldSelection(field)}
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

              {selectedResolution === 'merge' && mergedNormalized && isDifferent && (
                <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                  <div className="text-xs text-purple-700 dark:text-purple-300 mb-1 flex items-center gap-1">
                    <SparklesIcon className="h-3 w-3" />
                    Smart Merge Result:
                  </div>
                  <div className="font-mono text-xs">
                    {formatFieldValue(field, mergedNormalized[field])}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const formatFieldValue = (field: string, value: unknown): string => {
    if (value == null) return '(empty)';
    
    if (field.includes('amount') || field.includes('balance') || field === 'spent') {
      return formatCurrency(toNumber(value));
    }
    
    if (field.includes('date') || field.includes('_at')) {
      return formatDateValue(value);
    }
    
    if (Array.isArray(value)) {
      return value.map((item) => String(item)).join(', ') || '(none)';
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    return String(value);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Resolve Data Sync Conflict"
    >
      <div className="space-y-6">
        {/* Smart Resolution Header */}
        {analysis.canAutoResolve && (
          <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <SparklesIcon className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-green-900 dark:text-green-100">
                Smart Resolution Available
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                We can automatically merge these changes with {analysis.confidence}% confidence.
                {analysis.conflictingFields.length > 0 && 
                  ` ${analysis.conflictingFields.length} field(s) have conflicts but can be resolved intelligently.`
                }
              </p>
            </div>
          </div>
        )}

        {/* Conflict Summary */}
        {!analysis.canAutoResolve && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <AlertTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-amber-900 dark:text-amber-100">
                Manual Resolution Required
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                This {conflict.entity} was modified in incompatible ways. Please review the changes and choose how to resolve.
              </p>
            </div>
          </div>
        )}

        {/* Resolution Options */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Resolution Strategy</h4>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-gray-600 dark:text-gray-500 hover:underline"
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {analysis.canAutoResolve && (
              <button
                onClick={() => setSelectedResolution('merge')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedResolution === 'merge'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <MergeIcon className="h-6 w-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                <div className="text-sm font-medium">Smart Merge</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Intelligently combine changes
                </div>
              </button>
            )}

            <button
              onClick={() => setSelectedResolution('client')}
              className={`p-3 rounded-lg border-2 transition-all ${
                selectedResolution === 'client'
                  ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-2">💻</div>
              <div className="text-sm font-medium">Keep Your Version</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Use your local changes
              </div>
            </button>

            <button
              onClick={() => setSelectedResolution('server')}
              className={`p-3 rounded-lg border-2 transition-all ${
                selectedResolution === 'server'
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-2">☁️</div>
              <div className="text-sm font-medium">Keep Server Version</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Use server changes
              </div>
            </button>
          </div>
        </div>

        {/* Field-by-field comparison */}
        <div className="max-h-96 overflow-y-auto">
          {renderFieldComparison()}
        </div>

        {/* Resolution Summary */}
        {selectedResolution === 'merge' && mergedNormalized && (
          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <p className="text-sm text-purple-700 dark:text-purple-300">
              {ConflictResolutionService.generateConflictSummary(analysis)}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={isResolving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleResolve}
            disabled={isResolving}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isResolving ? (
              <>Resolving...</>
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                Apply {selectedResolution === 'merge' ? 'Smart Merge' : 'Resolution'}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// Icon components (add these to your icons file if not present)
const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M7 11L6 8l-3-1 3-1 1-3 1 3 3 1-3 1-1 3zm5 8l-1-2.5L8.5 15l2.5-1 1-2.5 1 2.5 2.5 1-2.5 1.5L12 19zm7-15l-1 3-3 1 3 1 1 3 1-3 3-1-3-1-1-3z"/>
  </svg>
);
