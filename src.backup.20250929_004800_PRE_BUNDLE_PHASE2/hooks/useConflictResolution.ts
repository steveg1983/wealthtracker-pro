/**
 * React hook for enhanced conflict resolution
 * Provides easy access to conflict detection and resolution
 */

import { useState, useEffect, useCallback } from 'react';
import { ConflictResolutionService } from '../services/conflictResolutionService';
import type { ConflictAnalysis } from '../services/conflictResolutionService';
import { syncService } from '../services/syncService';
import { logger } from '../services/loggingService';

export interface ConflictState {
  hasConflicts: boolean;
  conflicts: any[];
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
  
  const [currentConflict, setCurrentConflict] = useState<any>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<ConflictAnalysis | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const queueConflict = useCallback((conflict: any, analysis?: ConflictAnalysis | null) => {
    if (!conflict) {
      return;
    }

    const computedAnalysis = analysis ?? ConflictResolutionService.analyzeConflict(
      conflict.entity,
      conflict.clientData,
      conflict.serverData,
      conflict.clientTimestamp || Date.now(),
      conflict.serverTimestamp || Date.now()
    );

    setConflictState(prev => {
      const filtered = prev.conflicts.filter(existing => existing?.id !== conflict.id);
      const updatedConflicts = [...filtered, conflict];
      const requiresUser = prev.requiresUserIntervention || ConflictResolutionService.requiresUserIntervention(computedAnalysis);

      return {
        ...prev,
        hasConflicts: updatedConflicts.length > 0,
        conflicts: updatedConflicts,
        requiresUserIntervention: requiresUser
      };
    });

    setCurrentConflict(conflict);
    setCurrentAnalysis(computedAnalysis);
    setIsModalOpen(true);
  }, []);

  useEffect(() => {
    // Track auto-resolved conflicts
    let autoResolvedCount = 0;

    const handleConflictDetected = ({ conflict, analysis }: any) => {
      logger.warn('Conflict detected', { entity: conflict.entity, analysis });
      
      // Check if it requires user intervention
      if (ConflictResolutionService.requiresUserIntervention(analysis)) {
        queueConflict(conflict, analysis);
      }
    };

    const handleConflictAutoResolved = ({ conflict, analysis, resolution }: any) => {
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

    const handleStatusChanged = (status: any) => {
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
  }, [currentConflict, queueConflict]);

  const resolveConflict = useCallback(async (
    resolution: 'client' | 'server' | 'merge',
    mergedData?: any
  ) => {
    if (!currentConflict) return;
    
    try {
      // Resolve via sync service
      const serviceResolution: 'local' | 'remote' | 'merge' =
        resolution === 'client' ? 'local' : resolution === 'server' ? 'remote' : 'merge';

      syncService.resolveConflict(
        currentConflict.id,
        serviceResolution,
        serviceResolution === 'merge' ? mergedData : undefined
      );

      let nextConflict: any | null = null;
      let nextAnalysis: ConflictAnalysis | null = null;

      setConflictState(prev => {
        const filtered = prev.conflicts.filter(c => c.id !== currentConflict.id);
        if (filtered.length > 0) {
          nextConflict = filtered[0];
          nextAnalysis = ConflictResolutionService.analyzeConflict(
            filtered[0].entity,
            filtered[0].clientData,
            filtered[0].serverData,
            filtered[0].clientTimestamp || Date.now(),
            filtered[0].serverTimestamp || Date.now()
          );
        }

        return {
          ...prev,
          conflicts: filtered,
          hasConflicts: filtered.length > 0,
          requiresUserIntervention: filtered.length > 0
        };
      });

      if (nextConflict && nextAnalysis) {
        setCurrentConflict(nextConflict);
        setCurrentAnalysis(nextAnalysis);
        setIsModalOpen(true);
      } else {
        setCurrentConflict(null);
        setCurrentAnalysis(null);
        setIsModalOpen(false);
      }
    } catch (error) {
      logger.error('Failed to resolve conflict:', error);
    }
  }, [currentConflict]);

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
    clientData: any,
    serverData: any,
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
    queueConflict,
    analyzeConflict,

    // Utilities
    generateSummary: ConflictResolutionService.generateConflictSummary,
    requiresUserIntervention: ConflictResolutionService.requiresUserIntervention
  };
}
