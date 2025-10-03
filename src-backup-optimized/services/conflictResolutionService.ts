/**
 * Enhanced Conflict Resolution Service
 * Provides intelligent field-level merging and smart conflict detection
 * for a "top tier" sync experience
 */

import { isEqual, differenceWith, intersectionWith } from 'lodash';

export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

export interface ConflictAnalysis {
  hasConflict: boolean;
  conflictingFields: string[];
  nonConflictingFields: string[];
  canAutoResolve: boolean;
  suggestedResolution: 'merge' | 'client' | 'server' | 'manual';
  mergedData?: any;
  confidence: number; // 0-100 confidence in auto-resolution
  clientData: Record<string, any>;
  serverData: Record<string, any>;
  metadata?: {
    clientTimestamp?: string;
    serverTimestamp?: string;
  };
}

export interface MergeStrategy {
  type: 'fieldLevel' | 'lastWrite' | 'businessRule' | 'manual';
  rules?: MergeRule[];
}

export interface MergeRule {
  field: string;
  strategy: 'newer' | 'older' | 'sum' | 'min' | 'max' | 'concat' | 'union' | 'clientWins' | 'serverWins';
  condition?: (clientValue: any, serverValue: any) => boolean;
}

// Business rules for financial data
const FINANCIAL_MERGE_RULES: Record<string, MergeRule[]> = {
  account: [
    { field: 'balance', strategy: 'serverWins' }, // Server is source of truth for balances
    { field: 'name', strategy: 'newer' },
    { field: 'type', strategy: 'newer' },
    { field: 'currency', strategy: 'newer' },
    { field: 'is_active', strategy: 'serverWins' }, // Deletion state from server
  ],
  transaction: [
    { field: 'amount', strategy: 'newer' },
    { field: 'description', strategy: 'newer' },
    { field: 'category', strategy: 'newer' },
    { field: 'date', strategy: 'newer' },
    { field: 'cleared', strategy: 'max' }, // Once cleared, stays cleared
    { field: 'tags', strategy: 'union' }, // Merge tags from both
    { field: 'notes', strategy: 'concat' }, // Append notes
    { field: 'reconciled', strategy: 'max' }, // Once reconciled, stays reconciled
  ],
  budget: [
    { field: 'amount', strategy: 'min' }, // Conservative budget limit
    { field: 'spent', strategy: 'sum' }, // Add spent amounts
    { field: 'category', strategy: 'newer' },
    { field: 'period', strategy: 'newer' },
    { field: 'rollover', strategy: 'newer' },
  ],
  goal: [
    { field: 'targetAmount', strategy: 'newer' },
    { field: 'currentAmount', strategy: 'sum' }, // Sum contributions
    { field: 'deadline', strategy: 'newer' },
    { field: 'name', strategy: 'newer' },
    { field: 'achieved', strategy: 'max' }, // Once achieved, stays achieved
  ],
};

export class ConflictResolutionService {
  /**
   * Analyzes two versions of data to detect and potentially resolve conflicts
   */
  static analyzeConflict(
    entityType: string,
    clientData: any,
    serverData: any,
    clientTimestamp: number,
    serverTimestamp: number
  ): ConflictAnalysis {
    // Quick check: if data is identical, no conflict
    if (isEqual(clientData, serverData)) {
      return {
        hasConflict: false,
        conflictingFields: [],
        nonConflictingFields: [],
        canAutoResolve: true,
        suggestedResolution: 'merge',
        mergedData: clientData,
        confidence: 100,
        clientData,
        serverData,
        metadata: {
          clientTimestamp: new Date(clientTimestamp).toISOString(),
          serverTimestamp: new Date(serverTimestamp).toISOString()
        }
      };
    }

    // Find which fields changed
    const changedFields = this.getChangedFields(clientData, serverData);
    
    // Separate conflicting vs non-conflicting changes
    const analysis = this.categorizeChanges(
      entityType,
      clientData,
      serverData,
      changedFields,
      clientTimestamp,
      serverTimestamp
    );

    // Attempt smart merge if possible
    if (analysis.canAutoResolve) {
      analysis.mergedData = this.performSmartMerge(
        entityType,
        clientData,
        serverData,
        analysis,
        clientTimestamp,
        serverTimestamp
      );
    }

    return analysis;
  }

  /**
   * Get list of fields that differ between two objects
   */
  private static getChangedFields(obj1: any, obj2: any): string[] {
    const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
    const changedFields: string[] = [];

    for (const key of allKeys) {
      // Skip metadata fields
      if (['id', 'user_id', 'created_at', 'sync_version'].includes(key)) {
        continue;
      }

      if (!isEqual(obj1[key], obj2[key])) {
        changedFields.push(key);
      }
    }

    return changedFields;
  }

  /**
   * Categorize changes as conflicting or non-conflicting
   */
  private static categorizeChanges(
    entityType: string,
    clientData: any,
    serverData: any,
    changedFields: string[],
    clientTimestamp: number,
    serverTimestamp: number
  ): ConflictAnalysis {
    const conflictingFields: string[] = [];
    const nonConflictingFields: string[] = [];
    let canAutoResolve = true;
    let confidence = 100;

    for (const field of changedFields) {
      const clientValue = clientData[field];
      const serverValue = serverData[field];

      // Check if this is a true conflict or can be merged
      if (this.isNonConflictingChange(field, clientValue, serverValue, entityType)) {
        nonConflictingFields.push(field);
      } else {
        conflictingFields.push(field);
        
        // Check if we can auto-resolve this conflict
        const rule = this.getMergeRule(entityType, field);
        if (!rule) {
          canAutoResolve = false;
          confidence = 0;
        } else {
          // Reduce confidence for each conflicting field
          confidence = Math.max(0, confidence - 10);
        }
      }
    }

    // Determine suggested resolution strategy
    let suggestedResolution: ConflictAnalysis['suggestedResolution'] = 'manual';
    
    if (changedFields.length === 0) {
      suggestedResolution = 'merge';
      confidence = 100;
    } else if (conflictingFields.length === 0) {
      suggestedResolution = 'merge';
      confidence = 95;
    } else if (canAutoResolve) {
      suggestedResolution = 'merge';
      confidence = Math.max(confidence, 70);
    } else if (clientTimestamp > serverTimestamp) {
      suggestedResolution = 'client';
      confidence = 50;
    } else {
      suggestedResolution = 'server';
      confidence = 50;
    }

    return {
      hasConflict: conflictingFields.length > 0,
      conflictingFields,
      nonConflictingFields,
      canAutoResolve,
      suggestedResolution,
      confidence,
      clientData,
      serverData,
      metadata: {
        clientTimestamp: new Date(clientTimestamp).toISOString(),
        serverTimestamp: new Date(serverTimestamp).toISOString()
      }
    };
  }

  /**
   * Check if a change is non-conflicting (can be automatically merged)
   */
  private static isNonConflictingChange(
    field: string,
    clientValue: any,
    serverValue: any,
    entityType: string
  ): boolean {
    // If one is undefined/null and other has value, take the value
    if ((clientValue == null && serverValue != null) || 
        (clientValue != null && serverValue == null)) {
      return true;
    }

    // Special handling for arrays (tags, categories, etc)
    if (Array.isArray(clientValue) && Array.isArray(serverValue)) {
      // If arrays have no overlapping changes, they can be merged
      return true; // Will be union merged
    }

    // Special handling for notes/description fields - can be concatenated
    if (['notes', 'description', 'memo'].includes(field)) {
      return true; // Will be concatenated
    }

    // For boolean fields like 'cleared' or 'reconciled', true wins
    if (typeof clientValue === 'boolean' && typeof serverValue === 'boolean') {
      return true; // Will use MAX strategy
    }

    // Different fields changed = non-conflicting
    return false;
  }

  /**
   * Get merge rule for a specific field
   */
  private static getMergeRule(entityType: string, field: string): MergeRule | undefined {
    const rules = FINANCIAL_MERGE_RULES[entityType];
    if (!rules) return undefined;
    
    return rules.find(r => r.field === field);
  }

  /**
   * Perform intelligent field-level merge
   */
  private static performSmartMerge(
    entityType: string,
    clientData: any,
    serverData: any,
    analysis: ConflictAnalysis,
    clientTimestamp: number,
    serverTimestamp: number
  ): any {
    const merged = { ...serverData }; // Start with server as base

    // Apply non-conflicting changes from client
    for (const field of analysis.nonConflictingFields) {
      const clientValue = clientData[field];
      const serverValue = serverData[field];
      
      merged[field] = this.mergeFieldValue(
        field,
        clientValue,
        serverValue,
        entityType,
        clientTimestamp,
        serverTimestamp
      );
    }

    // Apply merge rules for conflicting fields
    for (const field of analysis.conflictingFields) {
      const rule = this.getMergeRule(entityType, field);
      if (rule) {
        merged[field] = this.applyMergeRule(
          rule,
          clientData[field],
          serverData[field],
          clientTimestamp,
          serverTimestamp
        );
      } else {
        // Default to newer value
        merged[field] = clientTimestamp > serverTimestamp 
          ? clientData[field] 
          : serverData[field];
      }
    }

    // Preserve important metadata
    merged.updated_at = Math.max(clientTimestamp, serverTimestamp);
    
    return merged;
  }

  /**
   * Merge a single field value based on type and rules
   */
  private static mergeFieldValue(
    field: string,
    clientValue: any,
    serverValue: any,
    entityType: string,
    clientTimestamp: number,
    serverTimestamp: number
  ): any {
    // Handle null/undefined
    if (clientValue == null) return serverValue;
    if (serverValue == null) return clientValue;

    // Arrays - union merge
    if (Array.isArray(clientValue) && Array.isArray(serverValue)) {
      return [...new Set([...clientValue, ...serverValue])];
    }

    // Notes/descriptions - concatenate if different
    if (['notes', 'description', 'memo'].includes(field)) {
      if (clientValue === serverValue) return clientValue;
      
      // Concatenate with timestamp indicator
      const clientTime = new Date(clientTimestamp).toLocaleString();
      const serverTime = new Date(serverTimestamp).toLocaleString();
      
      return `${serverValue}\n---\n[Added ${clientTime}]: ${clientValue}`;
    }

    // Booleans - true wins (for cleared, reconciled, etc)
    if (typeof clientValue === 'boolean' && typeof serverValue === 'boolean') {
      return clientValue || serverValue;
    }

    // Default to newer value
    return clientTimestamp > serverTimestamp ? clientValue : serverValue;
  }

  /**
   * Apply a specific merge rule
   */
  private static applyMergeRule(
    rule: MergeRule,
    clientValue: any,
    serverValue: any,
    clientTimestamp: number,
    serverTimestamp: number
  ): any {
    // Check condition if exists
    if (rule.condition && !rule.condition(clientValue, serverValue)) {
      return serverValue; // Default to server if condition not met
    }

    switch (rule.strategy) {
      case 'newer':
        return clientTimestamp > serverTimestamp ? clientValue : serverValue;
      
      case 'older':
        return clientTimestamp < serverTimestamp ? clientValue : serverValue;
      
      case 'sum':
        return (Number(clientValue) || 0) + (Number(serverValue) || 0);
      
      case 'min':
        return Math.min(Number(clientValue) || 0, Number(serverValue) || 0);
      
      case 'max':
        return Math.max(Number(clientValue) || 0, Number(serverValue) || 0);
      
      case 'concat':
        if (clientValue === serverValue) return clientValue;
        return `${serverValue}\n${clientValue}`;
      
      case 'union':
        if (Array.isArray(clientValue) && Array.isArray(serverValue)) {
          return [...new Set([...clientValue, ...serverValue])];
        }
        return serverValue;
      
      case 'clientWins':
        return clientValue;
      
      case 'serverWins':
        return serverValue;
      
      default:
        return serverValue;
    }
  }

  /**
   * Generate a human-readable conflict summary
   */
  static generateConflictSummary(analysis: ConflictAnalysis): string {
    if (!analysis.hasConflict) {
      return 'No conflicts detected - changes can be merged automatically.';
    }

    const parts: string[] = [];
    
    if (analysis.conflictingFields.length > 0) {
      parts.push(`Conflicting fields: ${analysis.conflictingFields.join(', ')}`);
    }
    
    if (analysis.nonConflictingFields.length > 0) {
      parts.push(`Compatible changes: ${analysis.nonConflictingFields.join(', ')}`);
    }
    
    if (analysis.canAutoResolve) {
      parts.push(`Automatic resolution available (${analysis.confidence}% confidence)`);
    } else {
      parts.push('Manual resolution required');
    }
    
    return parts.join('\n');
  }

  /**
   * Check if conflict requires user intervention
   */
  static requiresUserIntervention(
    analysis: ConflictAnalysis,
    userPreferences?: { autoResolveThreshold?: number }
  ): boolean {
    const threshold = userPreferences?.autoResolveThreshold || 70;
    
    // Never auto-resolve if confidence too low
    if (analysis.confidence < threshold) {
      return true;
    }
    
    // Critical fields always require user review
    const criticalFields = ['amount', 'balance', 'targetAmount'];
    const hasCriticalConflict = analysis.conflictingFields.some(f => 
      criticalFields.includes(f)
    );
    
    if (hasCriticalConflict && analysis.confidence < 90) {
      return true;
    }
    
    return !analysis.canAutoResolve;
  }
}

// Export singleton instance for easy use
export const conflictResolver = new ConflictResolutionService();