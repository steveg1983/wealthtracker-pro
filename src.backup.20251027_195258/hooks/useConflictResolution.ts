/**
 * React hook for enhanced conflict resolution
 * Provides easy access to conflict detection and resolution
 */

import { useState, useEffect, useCallback } from 'react';
import { ConflictResolutionService } from '../services/conflictResolutionService';
import type { ConflictAnalysis } from '../services/conflictResolutionService';
import { syncService } from '../services/syncService';
import { logger } from '../services/loggingService';
import type {
  ConflictResolutionEvent,
  EntityType,
  SyncConflict,
  SyncStatus,
  SyncData
} from '../types/sync-types';
import {
  normalizeConflictValue,
  denormalizeConflictValue,
  type ConflictDataShape,
  type ConflictRawValue
} from '../utils/conflictNormalization';

type ConflictDataValue = Record<string, unknown>;

interface ConflictRecord<T extends EntityType = EntityType> {
  id: string;
  entity: T;
  clientData: ConflictDataValue;
  clientDataRaw: ConflictRawValue<T>;
  clientDataShape: ConflictDataShape;
  serverData: ConflictDataValue;
  serverDataRaw: ConflictRawValue<T>;
  serverDataShape: ConflictDataShape;
  clientTimestamp: number;
  serverTimestamp: number;
}

type ConflictQueuePayload = ConflictRecord | SyncConflict | Partial<ConflictRecord>;

type ConflictRecordType = ConflictRecord<EntityType>;

const ENTITY_TYPES: EntityType[] = ['transaction', 'account', 'budget', 'goal', 'category'];

const isEntityType = (value: unknown): value is EntityType =>
  typeof value === 'string' && ENTITY_TYPES.includes(value as EntityType);

const ensureTimestamp = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Date.now();
};

const isSyncConflict = (value: unknown): value is SyncConflict => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return 'localOperation' in candidate && 'remoteOperation' in candidate;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isConflictRecord = (value: unknown): value is ConflictRecord => {
  if (!isPlainObject(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const hasClientData = isPlainObject(candidate.clientData);
  const hasServerData = isPlainObject(candidate.serverData);

  return typeof candidate.id === 'string' &&
    isEntityType(candidate.entity) &&
    hasClientData &&
    hasServerData &&
    'clientTimestamp' in candidate &&
    'serverTimestamp' in candidate;
};

const generateConflictId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `conflict_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const toConflictRecord = (conflict: ConflictQueuePayload): ConflictRecordType | null => {
  if (isConflictRecord(conflict)) {
    const existing = conflict as ConflictRecordType;

    const clientBundle = normalizeConflictValue<EntityType>(existing.clientDataRaw ?? existing.clientData);
    const serverBundle = normalizeConflictValue<EntityType>(existing.serverDataRaw ?? existing.serverData);

    return {
      ...existing,
      clientData: clientBundle.normalized,
      clientDataRaw: existing.clientDataRaw ?? clientBundle.raw,
      clientDataShape: existing.clientDataShape ?? clientBundle.shape,
      serverData: serverBundle.normalized,
      serverDataRaw: existing.serverDataRaw ?? serverBundle.raw,
      serverDataShape: existing.serverDataShape ?? serverBundle.shape
    };
  }

  if (isSyncConflict(conflict)) {
    const { localOperation, remoteOperation, id } = conflict;
    const clientBundle = normalizeConflictValue(localOperation.data);
    const serverBundle = normalizeConflictValue(remoteOperation.data);

    return {
      id,
      entity: localOperation.entity,
      clientData: clientBundle.normalized,
      clientDataRaw: clientBundle.raw,
      clientDataShape: clientBundle.shape,
      serverData: serverBundle.normalized,
      serverDataRaw: serverBundle.raw,
      serverDataShape: serverBundle.shape,
      clientTimestamp: ensureTimestamp(localOperation.timestamp),
      serverTimestamp: ensureTimestamp(remoteOperation.timestamp)
    } as ConflictRecordType;
  }

  const candidate = conflict as Partial<ConflictRecord> & Record<string, unknown>;
  if (!isEntityType(candidate.entity)) {
    return null;
  }

  const clientBundle = normalizeConflictValue(candidate.clientDataRaw ?? candidate.clientData);
  const serverBundle = normalizeConflictValue(candidate.serverDataRaw ?? candidate.serverData);

  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : generateConflictId(),
    entity: candidate.entity,
    clientData: clientBundle.normalized,
    clientDataRaw: candidate.clientDataRaw ?? clientBundle.raw,
    clientDataShape: candidate.clientDataShape ?? clientBundle.shape,
    serverData: serverBundle.normalized,
    serverDataRaw: candidate.serverDataRaw ?? serverBundle.raw,
    serverDataShape: candidate.serverDataShape ?? serverBundle.shape,
    clientTimestamp: ensureTimestamp(candidate.clientTimestamp ?? candidate.timestamp),
    serverTimestamp: ensureTimestamp(candidate.serverTimestamp ?? candidate.timestamp)
  } as ConflictRecordType;
};

const computeAnalysis = (conflict: ConflictRecordType): ConflictAnalysis =>
  ConflictResolutionService.analyzeConflict(
    conflict.entity,
    conflict.clientDataRaw ?? conflict.clientData,
    conflict.serverDataRaw ?? conflict.serverData,
    conflict.clientTimestamp,
    conflict.serverTimestamp
  );

const mapStatusConflicts = (status: SyncStatus): ConflictRecordType[] =>
  status.conflicts
    .map(conflict => toConflictRecord(conflict))
    .filter((conflict): conflict is ConflictRecordType => conflict !== null);

export interface ConflictState {
  hasConflicts: boolean;
  conflicts: ConflictRecordType[];
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
  
  const [currentConflict, setCurrentConflict] = useState<ConflictRecordType | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<ConflictAnalysis | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const queueConflict = useCallback((conflictInput: ConflictQueuePayload, analysis?: ConflictAnalysis | null) => {
    const normalizedConflict = toConflictRecord(conflictInput);
    if (!normalizedConflict) {
      logger.warn('useConflictResolution: received invalid conflict payload', { conflictInput });
      return;
    }

    const computedAnalysis = analysis ?? computeAnalysis(normalizedConflict);

    setConflictState(prev => {
      const filtered = prev.conflicts.filter(existing => existing.id !== normalizedConflict.id);
      const updatedConflicts = [...filtered, normalizedConflict];
      const requiresUser = prev.requiresUserIntervention || ConflictResolutionService.requiresUserIntervention(computedAnalysis);

      return {
        ...prev,
        hasConflicts: updatedConflicts.length > 0,
        conflicts: updatedConflicts,
        requiresUserIntervention: requiresUser
      };
    });

    setCurrentConflict(normalizedConflict);
    setCurrentAnalysis(computedAnalysis);
    setIsModalOpen(true);
  }, []);

  useEffect(() => {
    // Track auto-resolved conflicts
    let autoResolvedCount = 0;

    const handleConflictDetected = ({ conflict, analysis }: ConflictResolutionEvent) => {
      const normalizedConflict = toConflictRecord(conflict);
      if (!normalizedConflict) {
        logger.warn('Conflict detected with unsupported payload', { conflict });
        return;
      }

      logger.warn('Conflict detected', { entity: normalizedConflict.entity, analysis });

      if (ConflictResolutionService.requiresUserIntervention(analysis)) {
        queueConflict(normalizedConflict, analysis);
      }
    };

    const handleConflictAutoResolved = ({ conflict, analysis }: ConflictResolutionEvent) => {
      const normalizedConflict = toConflictRecord(conflict);
      if (!normalizedConflict) {
        logger.info('Auto-resolved conflict with unsupported payload');
        return;
      }

      autoResolvedCount++;
      logger.info('Auto-resolved conflict', {
        count: autoResolvedCount,
        entity: normalizedConflict.entity,
        confidence: analysis.confidence
      });
      
      setConflictState(prev => ({
        ...prev,
        autoResolvedCount: autoResolvedCount
      }));
      
      // Show toast notification (if you have a notification system)
      const message = `Automatically merged ${normalizedConflict.entity} changes (${analysis.confidence}% confidence)`;
      logger.info(message);
    };

    const handleStatusChanged = (status: SyncStatus) => {
      const normalizedConflicts = mapStatusConflicts(status);

      if (normalizedConflicts.length > 0) {
        setConflictState(prev => ({
          ...prev,
          hasConflicts: true,
          conflicts: normalizedConflicts,
          requiresUserIntervention: true
        }));
      } else {
        setConflictState(prev => ({
          ...prev,
          hasConflicts: false,
          conflicts: [],
          requiresUserIntervention: false
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
  }, [queueConflict]);

  const resolveConflict = useCallback(async (
    resolution: 'client' | 'server' | 'merge',
    mergedData?: ConflictDataValue
  ) => {
    if (!currentConflict) return;
    
    try {
      // Resolve via sync service
      const serviceResolution: 'local' | 'remote' | 'merge' =
        resolution === 'client' ? 'local' : resolution === 'server' ? 'remote' : 'merge';

      let mergePayload: SyncData<EntityType> | undefined;

      if (serviceResolution === 'merge') {
        if (mergedData) {
          const fallbackRaw =
            (currentConflict.serverDataRaw ?? currentConflict.clientDataRaw) as ConflictRawValue<EntityType> | undefined;
          const targetShape = currentConflict.serverDataShape;
          const denormalized = denormalizeConflictValue<EntityType>(
            mergedData,
            targetShape,
            fallbackRaw
          );
          mergePayload = denormalized as SyncData<EntityType>;
        } else if (currentAnalysis?.mergedData) {
          mergePayload = currentAnalysis.mergedData as SyncData<EntityType>;
        }
      }

      syncService.resolveConflict(
        currentConflict.id,
        serviceResolution,
        mergePayload
      );

      window.dispatchEvent(
        new CustomEvent('conflict-resolved', {
          detail: {
            id: currentConflict.id,
            resolution: serviceResolution,
          },
        }),
      );

      let nextConflict: ConflictRecordType | null = null;
      let nextAnalysis: ConflictAnalysis | null = null;

      setConflictState(prev => {
        const filtered = prev.conflicts.filter(c => c.id !== currentConflict.id);
        const firstConflict = filtered.length > 0 ? filtered[0] : null;
        if (firstConflict) {
          nextConflict = firstConflict as ConflictRecordType;
          nextAnalysis = computeAnalysis(firstConflict as ConflictRecordType);
        }

        return {
          ...prev,
          conflicts: filtered,
          hasConflicts: filtered.length > 0,
          requiresUserIntervention: filtered.length > 0
        };
      });

      const conflictToShow = nextConflict;
      const analysisToShow = nextAnalysis;

      if (conflictToShow && analysisToShow) {
        setCurrentConflict(conflictToShow);
        setCurrentAnalysis(analysisToShow);
        setIsModalOpen(true);
      } else {
        setCurrentConflict(null);
        setCurrentAnalysis(null);
        setIsModalOpen(false);
      }
    } catch (error) {
      logger.error('Failed to resolve conflict:', error);
    }
  }, [currentConflict, currentAnalysis]);

  const dismissConflict = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const showConflictModal = useCallback(() => {
    if (currentConflict) {
      setIsModalOpen(true);
    } else if (conflictState.conflicts.length > 0) {
      const firstConflict = conflictState.conflicts[0];
      if (firstConflict) {
        const analysis = computeAnalysis(firstConflict);
        setCurrentConflict(firstConflict);
        setCurrentAnalysis(analysis);
        setIsModalOpen(true);
      }
    }
  }, [currentConflict, conflictState.conflicts]);

  const analyzeConflict = useCallback((
    entityType: EntityType,
    clientData: ConflictRawValue,
    serverData: ConflictRawValue,
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

export type { ConflictRecordType };
