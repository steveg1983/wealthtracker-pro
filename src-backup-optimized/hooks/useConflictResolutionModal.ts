/**
 * Custom Hook for Conflict Resolution Modal
 * Manages conflict resolution state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import { enhancedConflictModalService } from '../services/enhancedConflictModalService';
import { ConflictAnalysis } from '../services/conflictResolutionService';
import { useLogger } from '../services/ServiceProvider';

export interface UseConflictResolutionModalReturn {
  selectedResolution: 'client' | 'server' | 'merge';
  fieldSelections: Record<string, 'client' | 'server'>;
  isResolving: boolean;
  analysis: ConflictAnalysis | null;
  showAdvanced: boolean;
  userFields: string[];
  fieldStatus: Map<string, { isDifferent: boolean; isConflicting: boolean }>;
  setSelectedResolution: (resolution: 'client' | 'server' | 'merge') => void;
  setShowAdvanced: (show: boolean) => void;
  toggleFieldSelection: (field: string) => void;
  handleResolve: () => Promise<void>;
  getFieldMetadata: (field: string) => { displayName: string; type: string };
  getResolutionSummary: () => string;
}

export function useConflictResolutionModal(
  conflict: any,
  providedAnalysis: ConflictAnalysis | undefined,
  onResolve: (resolution: 'client' | 'server' | 'merge', mergedData?: any) => Promise<void>,
  onClose: () => void
): UseConflictResolutionModalReturn {
  const logger = useLogger();
  const [selectedResolution, setSelectedResolution] = useState<'client' | 'server' | 'merge'>('merge');
  const [fieldSelections, setFieldSelections] = useState<Record<string, 'client' | 'server'>>({});
  const [isResolving, setIsResolving] = useState(false);
  const [analysis, setAnalysis] = useState<ConflictAnalysis | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [userFields, setUserFields] = useState<string[]>([]);
  const [fieldStatus, setFieldStatus] = useState<Map<string, { isDifferent: boolean; isConflicting: boolean }>>(new Map());

  // Analyze conflict on mount or when conflict changes
  useEffect(() => {
    if (!conflict) return;

    if (providedAnalysis) {
      setAnalysis(providedAnalysis);
      const defaultResolution = enhancedConflictModalService.getDefaultResolution(providedAnalysis);
      setSelectedResolution(defaultResolution);
    } else {
      const result = enhancedConflictModalService.analyzeConflict({
        entity: conflict.entity,
        clientData: conflict.clientData,
        serverData: conflict.serverData,
        clientTimestamp: conflict.clientTimestamp,
        serverTimestamp: conflict.serverTimestamp
      });
      
      setAnalysis(result.analysis);
      setSelectedResolution(result.defaultResolution);
    }

    // Get user fields and their status
    const fields = enhancedConflictModalService.getUserFields(
      conflict.clientData,
      conflict.serverData
    );
    setUserFields(fields);

    if (providedAnalysis || analysis) {
      const conflicts = enhancedConflictModalService.getFieldConflicts(
        conflict.clientData,
        conflict.serverData,
        (providedAnalysis || analysis)?.conflictingFields || []
      );
      
      // Transform the Map to match expected type
      const status = new Map<string, { isDifferent: boolean; isConflicting: boolean }>();
      conflicts.forEach((value, key) => {
        status.set(key, {
          isDifferent: value.client !== value.server,
          isConflicting: value.isConflict
        });
      });
      
      setFieldStatus(status);
    }
  }, [conflict, providedAnalysis]);

  // Toggle field selection for custom merge
  const toggleFieldSelection = useCallback((field: string) => {
    setFieldSelections(prev => ({
      ...prev,
      [field]: prev[field] === 'client' ? 'server' : 'client'
    }));
  }, []);

  // Handle conflict resolution
  const handleResolve = useCallback(async () => {
    if (!conflict || !analysis) return;

    setIsResolving(true);

    try {
      let resolvedData;

      if (selectedResolution === 'merge') {
        if (showAdvanced && Object.keys(fieldSelections).length > 0) {
          // Custom field-by-field merge
          const fieldSelectionsMap = new Map(Object.entries(fieldSelections));
          resolvedData = enhancedConflictModalService.buildMergedData(
            analysis,
            fieldSelectionsMap
          );
        } else {
          // Use auto-merged data
          resolvedData = analysis.mergedData;
        }
      } else if (selectedResolution === 'client') {
        resolvedData = conflict.clientData;
      } else {
        resolvedData = conflict.serverData;
      }

      // Call the onResolve callback with the resolved data
      await onResolve(selectedResolution, resolvedData);

      onClose();
    } catch (error) {
      logger.error('Failed to resolve conflict:', error);
    } finally {
      setIsResolving(false);
    }
  }, [conflict, analysis, selectedResolution, showAdvanced, fieldSelections, onResolve, onClose]);

  // Get field metadata
  const getFieldMetadata = useCallback((field: string) => {
    return enhancedConflictModalService.getFieldMetadata(field);
  }, []);

  // Get resolution summary
  const getResolutionSummary = useCallback(() => {
    if (!analysis) return '';
    
    return enhancedConflictModalService.formatResolutionSummary(
      analysis,
      selectedResolution
    );
  }, [selectedResolution, analysis, showAdvanced, fieldSelections]);

  return {
    selectedResolution,
    fieldSelections,
    isResolving,
    analysis,
    showAdvanced,
    userFields,
    fieldStatus,
    setSelectedResolution,
    setShowAdvanced,
    toggleFieldSelection,
    handleResolve,
    getFieldMetadata,
    getResolutionSummary
  };
}