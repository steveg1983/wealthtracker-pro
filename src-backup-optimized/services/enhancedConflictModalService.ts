/**
 * Enhanced Conflict Modal Service
 * Handles conflict resolution logic and field merging
 */

import { ConflictResolutionService, ConflictAnalysis } from './conflictResolutionService';
import { lazyLogger as logger } from './serviceFactory';

export interface FieldSelection {
  field: string;
  source: 'client' | 'server';
}

export interface ConflictData {
  entity: string;
  clientData: Record<string, any>;
  serverData: Record<string, any>;
  clientTimestamp?: number;
  serverTimestamp?: number;
}

export interface ResolutionStrategy {
  type: 'client' | 'server' | 'merge';
  fieldSelections?: Record<string, 'client' | 'server'>;
}

class EnhancedConflictModalService {
  /**
   * Analyze conflict and determine default resolution
   */
  analyzeConflict(conflict: ConflictData): {
    analysis: ConflictAnalysis;
    defaultResolution: 'client' | 'server' | 'merge';
  } {
    const analysis = ConflictResolutionService.analyzeConflict(
      conflict.entity,
      conflict.clientData,
      conflict.serverData,
      conflict.clientTimestamp || Date.now(),
      conflict.serverTimestamp || Date.now()
    );

    let defaultResolution: 'client' | 'server' | 'merge';
    if (analysis.canAutoResolve && analysis.mergedData) {
      defaultResolution = 'merge';
    } else {
      defaultResolution = analysis.suggestedResolution === 'client' ? 'client' : 'server';
    }

    return { analysis, defaultResolution };
  }

  /**
   * Get user-visible fields from data objects
   */
  getUserFields(clientData: Record<string, any>, serverData: Record<string, any>): string[] {
    const allFields = new Set([
      ...Object.keys(clientData || {}),
      ...Object.keys(serverData || {})
    ]);

    // Skip system fields
    return Array.from(allFields).filter(field => 
      !['id', 'user_id', 'created_at', 'updated_at', 'sync_version'].includes(field)
    );
  }

  /**
   * Apply field selections to create merged data
   */
  applyFieldSelections(
    clientData: Record<string, any>,
    serverData: Record<string, any>,
    fieldSelections: Record<string, 'client' | 'server'>
  ): Record<string, any> {
    const resolvedData = { ...serverData };
    
    for (const [field, source] of Object.entries(fieldSelections)) {
      resolvedData[field] = source === 'client' 
        ? clientData[field] 
        : serverData[field];
    }

    return resolvedData;
  }

  /**
   * Resolve conflict with selected strategy
   */
  async resolveConflict(
    conflict: ConflictData,
    strategy: ResolutionStrategy,
    analysis: ConflictAnalysis,
    onResolve: (resolution: 'client' | 'server' | 'merge', mergedData?: unknown) => void
  ): Promise<void> {
    try {
      let resolvedData: Record<string, any>;
      
      if (strategy.type === 'merge') {
        if (strategy.fieldSelections && Object.keys(strategy.fieldSelections).length > 0) {
          // Custom field-by-field merge
          resolvedData = this.applyFieldSelections(
            conflict.clientData,
            conflict.serverData,
            strategy.fieldSelections
          );
        } else {
          // Use auto-merged data
          resolvedData = analysis.mergedData as Record<string, any>;
        }
      } else if (strategy.type === 'client') {
        resolvedData = conflict.clientData;
      } else {
        resolvedData = conflict.serverData;
      }
      
      await onResolve(strategy.type, resolvedData);
    } catch (error) {
      logger.error('Failed to resolve conflict:', error);
      throw error;
    }
  }

  /**
   * Get field conflict status
   */
  getFieldStatus(
    field: string,
    clientValue: any,
    serverValue: any,
    analysis: ConflictAnalysis
  ): {
    isDifferent: boolean;
    isConflicting: boolean;
    statusLabel: string;
    statusColor: string;
  } {
    const isDifferent = clientValue !== serverValue;
    const isConflicting = analysis.conflictingFields.includes(field);

    return {
      isDifferent,
      isConflicting,
      statusLabel: isConflicting ? 'Conflict' : isDifferent ? 'Compatible' : '',
      statusColor: isConflicting 
        ? 'amber' 
        : isDifferent 
          ? 'green' 
          : 'gray'
    };
  }

  /**
   * Format summary message for resolution
   */
  formatResolutionSummary(
    analysis: ConflictAnalysis,
    selectedResolution: 'client' | 'server' | 'merge'
  ): string {
    if (selectedResolution === 'merge' && analysis.mergedData) {
      return ConflictResolutionService.generateConflictSummary(analysis);
    }
    
    if (selectedResolution === 'client') {
      return 'Your local changes will be preserved and server changes will be overwritten.';
    }
    
    return 'Server changes will be preserved and your local changes will be overwritten.';
  }

  /**
   * Get default resolution strategy based on analysis
   */
  getDefaultResolution(analysis: ConflictAnalysis): 'client' | 'server' | 'merge' {
    // Default to merge if available, otherwise use the most recent data
    if (analysis.mergedData) {
      return 'merge';
    }
    
    // Compare timestamps if available
    if (analysis.metadata?.clientTimestamp && analysis.metadata?.serverTimestamp) {
      const clientTime = new Date(analysis.metadata.clientTimestamp).getTime();
      const serverTime = new Date(analysis.metadata.serverTimestamp).getTime();
      return clientTime > serverTime ? 'client' : 'server';
    }
    
    return 'server'; // Default to server if no other criteria
  }

  /**
   * Get field-level conflicts
   */
  getFieldConflicts(
    clientData: Record<string, any>,
    serverData: Record<string, any>,
    conflictingFields: string[]
  ): Map<string, { client: any; server: any; isConflict: boolean }> {
    const fieldConflicts = new Map();
    
    // Get all unique fields
    const allFields = new Set([
      ...Object.keys(clientData || {}),
      ...Object.keys(serverData || {})
    ]);
    
    allFields.forEach(field => {
      const clientValue = clientData?.[field];
      const serverValue = serverData?.[field];
      const isConflict = conflictingFields.includes(field);
      
      fieldConflicts.set(field, {
        client: clientValue,
        server: serverValue,
        isConflict
      });
    });
    
    return fieldConflicts;
  }

  /**
   * Build merged data from field selections
   */
  buildMergedData(
    analysis: ConflictAnalysis,
    fieldSelections: Map<string, 'client' | 'server'>
  ): Record<string, any> {
    const merged: Record<string, any> = {};
    
    fieldSelections.forEach((source, field) => {
      const value = source === 'client' 
        ? analysis.clientData[field]
        : analysis.serverData[field];
      merged[field] = value;
    });
    
    return merged;
  }

  /**
   * Process the selected resolution
   */
  processResolution(
    analysis: ConflictAnalysis,
    resolution: 'client' | 'server' | 'merge',
    fieldSelections?: Map<string, 'client' | 'server'>
  ): Record<string, any> {
    if (resolution === 'merge' && fieldSelections) {
      return this.buildMergedData(analysis, fieldSelections);
    }
    
    return resolution === 'client' ? analysis.clientData : analysis.serverData;
  }

  /**
   * Get field metadata for display
   */
  getFieldMetadata(field: string): { displayName: string; type: string } {
    const metadata: Record<string, { displayName: string; type: string }> = {
      amount: { displayName: 'Amount', type: 'number' },
      description: { displayName: 'Description', type: 'string' },
      date: { displayName: 'Date', type: 'date' },
      category: { displayName: 'Category', type: 'string' },
      notes: { displayName: 'Notes', type: 'string' }
    };
    
    return metadata[field] || { displayName: field, type: 'string' };
  }
}

export const enhancedConflictModalService = new EnhancedConflictModalService();