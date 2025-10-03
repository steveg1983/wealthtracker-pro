/**
 * React hook for enhanced conflict resolution
 * Provides easy access to conflict detection and resolution
 */

import { useState, useEffect, useCallback } from 'react';
import { ConflictResolutionService, ConflictAnalysis } from '../services/conflictResolutionService';
import { syncService } from '../services/syncService';
import { logger } from '../services/loggingService';
import type { Transaction, Account, Budget, Goal } from '../types';

type EntityData = Transaction | Account | Budget | Goal;

export interface Conflict {
  id: string;
  entity: string;
  clientData: EntityData;
  serverData: EntityData;
  clientTimestamp?: number;
  serverTimestamp?: number;
}

export interface ConflictEvent {
  conflict: Conflict;
  analysis: ConflictAnalysis;
  resolution?: EntityData;
}

export interface SyncStatus {
  conflicts: Conflict[];
  syncing: boolean;
  lastSync?: Date;
}

export interface ConflictState {
  hasConflicts: boolean;
  conflicts: Conflict[];
  autoResolvedCount: number;
  requiresUserIntervention: boolean;
}

export function useConflictResolution() {
  const [conflictState, setConflictState] = useState<ConflictState>({
    hasConflicts: false,
    conflicts: [],
    autoResolvedCount: 0,
    requiresUserIntervention: false
  });
  
  const [currentConflict, setCurrentConflict] = useState<Conflict | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<ConflictAnalysis | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Track auto-resolved conflicts
    let autoResolvedCount = 0;

    const handleConflictDetected = ({ conflict, analysis }: ConflictEvent) => {
      logger.warn('Conflict detected', { entity: conflict.entity, analysis });
      
      // Check if it requires user intervention
      if (ConflictResolutionService.requiresUserIntervention(analysis)) {
        setConflictState(prev => ({
          ...prev,
          hasConflicts: true,
          conflicts: [...prev.conflicts, conflict],
          requiresUserIntervention: true
        }));
        
        // Show modal for first conflict that needs attention
        if (!currentConflict) {
          setCurrentConflict(conflict);
          setCurrentAnalysis(analysis);
          setIsModalOpen(true);
        }
      }
    };

    const handleConflictAutoResolved = ({ conflict, analysis, resolution }: ConflictEvent) => {
      autoResolvedCount++;
      logger.info('Auto-resolved conflict', { count: autoResolvedCount, entity: conflict.entity, confidence: analysis.confidence });
      
      setConflictState(prev => ({
        ...prev,
        autoResolvedCount: autoResolvedCount
      }));
      
      // Show toast notification (if you have a notification system)
      const message = `Automatically merged ${conflict.entity} changes (${analysis.confidence}% confidence)`;
      logger.info(message);
    };

    const handleStatusChanged = (status: SyncStatus) => {
      if (status.conflicts && status.conflicts.length > 0) {
        setConflictState(prev => ({
          ...prev,
          hasConflicts: true,
          conflicts: status.conflicts
        }));
      }
    };

    // Subscribe to sync events
    syncService.on('conflict-detected', handleConflictDetected);
    syncService.on('conflict-auto-resolved', handleConflictAutoResolved);
    syncService.on('status-changed', handleStatusChanged);

    return () => {
      syncService.off('conflict-detected', handleConflictDetected);
      syncService.off('conflict-auto-resolved', handleConflictAutoResolved);
      syncService.off('status-changed', handleStatusChanged);
    };
  }, [currentConflict]);

  const resolveConflict = useCallback(async (
    resolution: 'client' | 'server' | 'merge',
    mergedData?: EntityData
  ) => {
    if (!currentConflict) return;
    
    try {
      // Resolve via sync service
      syncService.resolveConflict(currentConflict.id, resolution, mergedData);
      
      // Remove from state
      setConflictState(prev => ({
        ...prev,
        conflicts: prev.conflicts.filter(c => c.id !== currentConflict.id),
        hasConflicts: prev.conflicts.length > 1,
        requiresUserIntervention: prev.conflicts.length > 1
      }));
      
      // Close modal and move to next conflict if any
      setIsModalOpen(false);
      
      // Check for next conflict
      const remainingConflicts = conflictState.conflicts.filter(c => c.id !== currentConflict.id);
      if (remainingConflicts.length > 0) {
        const nextConflict = remainingConflicts[0];
        const nextAnalysis = ConflictResolutionService.analyzeConflict(
          nextConflict.entity,
          nextConflict.clientData,
          nextConflict.serverData,
          nextConflict.clientTimestamp || Date.now(),
          nextConflict.serverTimestamp || Date.now()
        );
        
        setCurrentConflict(nextConflict);
        setCurrentAnalysis(nextAnalysis);
        setIsModalOpen(true);
      } else {
        setCurrentConflict(null);
        setCurrentAnalysis(null);
      }
    } catch (error) {
      logger.error('Failed to resolve conflict:', error);
    }
  }, [currentConflict, conflictState.conflicts]);

  const dismissConflict = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const showConflictModal = useCallback(() => {
    if (currentConflict) {
      setIsModalOpen(true);
    } else if (conflictState.conflicts.length > 0) {
      const firstConflict = conflictState.conflicts[0];
      const analysis = ConflictResolutionService.analyzeConflict(
        firstConflict.entity,
        firstConflict.clientData,
        firstConflict.serverData,
        firstConflict.clientTimestamp || Date.now(),
        firstConflict.serverTimestamp || Date.now()
      );
      
      setCurrentConflict(firstConflict);
      setCurrentAnalysis(analysis);
      setIsModalOpen(true);
    }
  }, [currentConflict, conflictState.conflicts]);

  const analyzeConflict = useCallback((
    entityType: string,
    clientData: EntityData,
    serverData: EntityData,
    clientTimestamp?: number,
    serverTimestamp?: number
  ): ConflictAnalysis => {
    return ConflictResolutionService.analyzeConflict(
      entityType,
      clientData,
      serverData,
      clientTimestamp || Date.now(),
      serverTimestamp || Date.now()
    );
  }, []);

  return {
    // State
    conflictState,
    currentConflict,
    currentAnalysis,
    isModalOpen,
    
    // Actions
    resolveConflict,
    dismissConflict,
    showConflictModal,
    analyzeConflict,
    
    // Utilities
    generateSummary: ConflictResolutionService.generateConflictSummary,
    requiresUserIntervention: ConflictResolutionService.requiresUserIntervention
  };
}
