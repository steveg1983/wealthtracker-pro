/**
 * React hook for enhanced conflict resolution
 * Provides easy access to conflict detection and resolution.
 *
 * Conflicts are delivered over a window CustomEvent channel
 * ('wt:conflict-detected') so any sync layer can raise them. The previous
 * socket.io syncService was removed — it targeted a backend that does not
 * exist in this deployment and silently dropped failed operations.
 */

import { useState, useEffect, useCallback } from 'react';
import { ConflictResolutionService, ConflictAnalysis } from '../services/conflictResolutionService';
import { useMemoizedLogger } from '../loggers/useMemoizedLogger';

interface Conflict {
  id: string;
  entity: string;
  clientData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  clientTimestamp?: number;
  serverTimestamp?: number;
}

export interface ConflictState {
  hasConflicts: boolean;
  conflicts: Conflict[];
  autoResolvedCount: number;
  requiresUserIntervention: boolean;
}

export const CONFLICT_DETECTED_EVENT = 'wt:conflict-detected';
export const CONFLICT_RESOLVED_EVENT = 'wt:conflict-resolved';

/** Raise a conflict for user review from any sync layer. */
export function dispatchConflictDetected(conflict: Conflict, analysis: ConflictAnalysis): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONFLICT_DETECTED_EVENT, { detail: { conflict, analysis } }));
  }
}

export function useConflictResolution() {
  const logger = useMemoizedLogger('useConflictResolution');
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
    const handleConflictDetected = (event: Event) => {
      const { conflict, analysis } = (event as CustomEvent).detail as {
        conflict: Conflict;
        analysis: ConflictAnalysis;
      };
      logger.info?.('Conflict detected', { entity: conflict.entity, analysis });

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
      } else {
        setConflictState(prev => ({
          ...prev,
          autoResolvedCount: prev.autoResolvedCount + 1
        }));
      }
    };

    window.addEventListener(CONFLICT_DETECTED_EVENT, handleConflictDetected);
    return () => {
      window.removeEventListener(CONFLICT_DETECTED_EVENT, handleConflictDetected);
    };
  }, [currentConflict, logger]);

  const resolveConflict = useCallback(async (
    resolution: 'client' | 'server' | 'merge',
    mergedData?: Record<string, unknown>
  ) => {
    if (!currentConflict) return;

    try {
      // Notify whichever sync layer raised the conflict of the user's choice.
      window.dispatchEvent(new CustomEvent(CONFLICT_RESOLVED_EVENT, {
        detail: { conflictId: currentConflict.id, resolution, mergedData }
      }));

      // Remove from state
      setConflictState(prev => ({
        ...prev,
        conflicts: prev.conflicts.filter(c => c.id !== currentConflict.id),
        hasConflicts: prev.conflicts.length > 1,
        requiresUserIntervention: prev.conflicts.length > 1
      }));

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
      logger.error?.('Failed to resolve conflict', error);
    }
  }, [currentConflict, conflictState.conflicts, logger]);

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
    clientData: Record<string, unknown>,
    serverData: Record<string, unknown>,
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
