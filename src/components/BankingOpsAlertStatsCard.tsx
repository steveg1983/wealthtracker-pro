import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { bankConnectionService, type BankingApiError } from '../services/bankConnectionService';
import type { DeadLetterAdminAuditResponse, DeadLetterAdminListResponse, OpsAlertStatsResponse } from '../types/banking-api';
import type { BankingAuditDateRangePreset, BankingAuditScope } from '../utils/bankingOpsUrlState';
import { replaceBrowserSearch, withBankingOpsUrlState } from '../utils/bankingOpsUrlState';
import { TRUELAYER_JWKS_CIRCUIT_EVENT_PREFIX } from '../constants/bankingOps';
import { AlertCircleIcon, BarChart3Icon, CheckCircleIcon, DownloadIcon, FileTextIcon, LinkIcon, RefreshCwIcon, SendIcon } from './icons';
import { createScopedLogger } from '../loggers/scopedLogger';

const DEFAULT_LIMIT = 10;
const DEFAULT_MIN_SUPPRESSED = 1;
const AUTO_REFRESH_INTERVAL_MS = 30000;
const RESET_ALL_CONFIRMATION = 'RESET_ALL_DEAD_LETTERED';
const RESET_ALL_LIMIT = 200;
const RESET_PREVIEW_LIMIT = 25;
const BULK_SELECTED_CONFIRM_THRESHOLD = 10;
const BULK_SELECTED_CONFIRMATION = 'RESET_SELECTED_BULK';
const AUDIT_PAGE_LIMIT = 25;
const AUDIT_EXPORT_LIMIT = 1000;
const AUDIT_DATE_RANGE_PRESET_TO_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000
} as const;
type AuditDateRangePreset = BankingAuditDateRangePreset | '';
type AuditScopeValue = BankingAuditScope | '';

interface BankingOpsAlertStatsCardProps {
  initialOnlyAboveThreshold?: boolean;
  initialEventType?: string;
  initialEventTypePrefix?: string;
  initialShowAuditPanel?: boolean;
  initialAuditStatus?: 'pending' | 'completed' | 'failed';
  initialAuditScope?: BankingAuditScope;
  initialAuditDateRangePreset?: BankingAuditDateRangePreset;
}

interface ActionFeedback {
  kind: 'success' | 'error';
  message: string;
}

const copyToClipboard = async (value: string): Promise<void> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard API is unavailable');
  }

  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.focus();
  input.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(input);
  if (!copied) {
    throw new Error('Copy failed');
  }
};

const isBankingApiError = (value: unknown): value is BankingApiError =>
  typeof value === 'object' &&
  value !== null &&
  'status' in value &&
  typeof (value as { status?: unknown }).status === 'number';

const formatTimestamp = (value: string | null): string => {
  if (!value) {
    return 'n/a';
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return format(timestamp, 'MMM d, yyyy HH:mm');
};

const parseAuditDateRangePreset = (value: string): AuditDateRangePreset => (
  value === '24h' || value === '7d' || value === '30d'
    ? value
    : ''
);

const parseAuditStatusValue = (value: string): 'pending' | 'completed' | 'failed' | '' => (
  value === 'pending' || value === 'completed' || value === 'failed'
    ? value
    : ''
);

const parseAuditScope = (value: string): AuditScopeValue => (
  value === 'single' || value === 'bulk' || value === 'all_dead_lettered'
    ? value
    : ''
);

const buildAuditDateRange = (preset: AuditDateRangePreset): { since: string; until: string } | null => {
  if (!preset) {
    return null;
  }
  const windowMs = AUDIT_DATE_RANGE_PRESET_TO_MS[preset];
  const until = new Date();
  const since = new Date(until.getTime() - windowMs);
  return {
    since: since.toISOString(),
    until: until.toISOString()
  };
};

export default function BankingOpsAlertStatsCard({
  initialOnlyAboveThreshold = false,
  initialEventType,
  initialEventTypePrefix,
  initialShowAuditPanel = false,
  initialAuditStatus,
  initialAuditScope,
  initialAuditDateRangePreset
}: BankingOpsAlertStatsCardProps) {
  const [stats, setStats] = useState<OpsAlertStatsResponse | null>(null);
  const [eventType, setEventType] = useState(() => initialEventType?.trim() ?? '');
  const [eventTypePrefix, setEventTypePrefix] = useState(() => initialEventTypePrefix?.trim() ?? '');
  const [minSuppressed, setMinSuppressed] = useState(String(DEFAULT_MIN_SUPPRESSED));
  const [limit, setLimit] = useState(String(DEFAULT_LIMIT));
  const [onlyAboveThreshold, setOnlyAboveThreshold] = useState(initialOnlyAboveThreshold);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingTestAlert, setIsSendingTestAlert] = useState(false);
  const [isResettingDeadLetter, setIsResettingDeadLetter] = useState(false);
  const [showDeadLetterResetForm, setShowDeadLetterResetForm] = useState(false);
  const [deadLetterResetConfirm, setDeadLetterResetConfirm] = useState('');
  const [deadLetterResetReason, setDeadLetterResetReason] = useState('');
  const [deadLetterPreview, setDeadLetterPreview] = useState<DeadLetterAdminListResponse | null>(null);
  const [selectedDeadLetterConnectionIds, setSelectedDeadLetterConnectionIds] = useState<Set<string>>(new Set());
  const [bulkSelectedConfirm, setBulkSelectedConfirm] = useState('');
  const [isLoadingDeadLetterPreview, setIsLoadingDeadLetterPreview] = useState(false);
  const [showAuditPanel, setShowAuditPanel] = useState(initialShowAuditPanel);
  const [auditStatus, setAuditStatus] = useState<'pending' | 'completed' | 'failed' | ''>(initialAuditStatus ?? '');
  const [auditScope, setAuditScope] = useState<AuditScopeValue>(initialAuditScope ?? '');
  const [auditDateRangePreset, setAuditDateRangePreset] = useState<AuditDateRangePreset>(initialAuditDateRangePreset ?? '');
  const [auditData, setAuditData] = useState<DeadLetterAdminAuditResponse | null>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [isLoadingMoreAudit, setIsLoadingMoreAudit] = useState(false);
  const [isExportingAudit, setIsExportingAudit] = useState(false);
  const [isCopyingIncidentLink, setIsCopyingIncidentLink] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const logger = useMemo(() => createScopedLogger('BankingOpsAlertStatsCard'), []);

  const loadStats = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const parsedEventType = eventType.trim();
      const parsedEventTypePrefix = eventTypePrefix.trim();
      const parsedMinSuppressed = Math.max(0, Number.parseInt(minSuppressed, 10) || 0);
      const parsedLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || DEFAULT_LIMIT));
      const query: {
        eventType?: string;
        eventTypePrefix?: string;
        minSuppressed: number;
        limit: number;
        onlyAboveThreshold: boolean;
      } = {
        eventType: parsedEventType || undefined,
        minSuppressed: parsedMinSuppressed,
        limit: parsedLimit,
        onlyAboveThreshold
      };
      if (!query.eventType && parsedEventTypePrefix) {
        query.eventTypePrefix = parsedEventTypePrefix;
      }
      const response = await bankConnectionService.getOpsAlertStats(query);
      setStats(response);
      setIsVisible(true);
    } catch (loadError) {
      if (isBankingApiError(loadError) && (loadError.status === 403 || loadError.code === 'forbidden')) {
        setIsVisible(false);
        return;
      }
      const message = loadError instanceof Error ? loadError.message : 'Failed to load ops alert stats';
      setError(message);
      logger.warn('Failed to load ops alert stats', loadError as Error);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [eventType, eventTypePrefix, limit, logger, minSuppressed, onlyAboveThreshold]);

  const handleSendTestAlert = useCallback(async () => {
    setIsSendingTestAlert(true);
    setActionFeedback(null);

    try {
      await bankConnectionService.triggerOpsAlertTest();
      await loadStats({ silent: true });
      setActionFeedback({
        kind: 'success',
        message: 'Test alert sent and stats refreshed.'
      });
    } catch (sendError) {
      if (isBankingApiError(sendError) && (sendError.status === 403 || sendError.code === 'forbidden')) {
        setIsVisible(false);
        return;
      }
      const message = sendError instanceof Error ? sendError.message : 'Failed to send test alert';
      setActionFeedback({ kind: 'error', message });
      logger.warn('Failed to send ops alert test', sendError as Error);
    } finally {
      setIsSendingTestAlert(false);
    }
  }, [loadStats, logger]);

  const loadDeadLetterPreview = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setIsLoadingDeadLetterPreview(true);
    }

    try {
      const response = await bankConnectionService.getDeadLetterRows(RESET_PREVIEW_LIMIT);
      setDeadLetterPreview(response);
      setSelectedDeadLetterConnectionIds((previous) => {
        const previewIds = new Set(response.rows.map((row) => row.connectionId));
        return new Set(Array.from(previous).filter((connectionId) => previewIds.has(connectionId)));
      });
    } catch (loadError) {
      if (isBankingApiError(loadError) && (loadError.status === 403 || loadError.code === 'forbidden')) {
        setIsVisible(false);
        return;
      }
      logger.warn('Failed to load dead-letter preview rows', loadError as Error);
    } finally {
      if (!silent) {
        setIsLoadingDeadLetterPreview(false);
      }
    }
  }, [logger]);

  const handleResetAllDeadLettered = useCallback(async () => {
    setIsResettingDeadLetter(true);
    setActionFeedback(null);

    try {
      const response = await bankConnectionService.resetAllDeadLettered(
        deadLetterResetConfirm.trim(),
        deadLetterResetReason,
        RESET_ALL_LIMIT
      );

      await loadStats({ silent: true });
      await loadDeadLetterPreview({ silent: true });
      setActionFeedback({
        kind: 'success',
        message: `Reset ${response.requested} dead-letter connection(s). Audit ${response.auditId} is ${response.auditStatus}.`
      });
      setDeadLetterResetConfirm('');
      setDeadLetterResetReason('');
      setSelectedDeadLetterConnectionIds(new Set());
      setBulkSelectedConfirm('');
      setShowDeadLetterResetForm(false);
    } catch (resetError) {
      if (isBankingApiError(resetError) && (resetError.status === 403 || resetError.code === 'forbidden')) {
        setIsVisible(false);
        return;
      }
      const message = resetError instanceof Error ? resetError.message : 'Failed to reset dead-letter connections';
      setActionFeedback({ kind: 'error', message });
      logger.warn('Failed to reset dead-letter rows', resetError as Error);
    } finally {
      setIsResettingDeadLetter(false);
    }
  }, [deadLetterResetConfirm, deadLetterResetReason, loadDeadLetterPreview, loadStats, logger]);

  const handleResetSelectedDeadLettered = useCallback(async () => {
    const targetConnectionIds = Array.from(selectedDeadLetterConnectionIds);
    if (targetConnectionIds.length === 0) {
      return;
    }

    setIsResettingDeadLetter(true);
    setActionFeedback(null);

    try {
      const bulkConfirmToken = bulkSelectedConfirm.trim();
      const response = await bankConnectionService.resetDeadLetterConnections(
        targetConnectionIds,
        deadLetterResetReason,
        bulkConfirmToken || undefined
      );

      await loadStats({ silent: true });
      await loadDeadLetterPreview({ silent: true });
      setActionFeedback({
        kind: 'success',
        message: `Reset ${response.requested} selected dead-letter connection(s). Audit ${response.auditId} is ${response.auditStatus}.`
      });
      setSelectedDeadLetterConnectionIds(new Set());
      setBulkSelectedConfirm('');
    } catch (resetError) {
      if (isBankingApiError(resetError) && (resetError.status === 403 || resetError.code === 'forbidden')) {
        setIsVisible(false);
        return;
      }
      const message = resetError instanceof Error ? resetError.message : 'Failed to reset selected dead-letter connections';
      setActionFeedback({ kind: 'error', message });
      logger.warn('Failed to reset selected dead-letter rows', resetError as Error);
    } finally {
      setIsResettingDeadLetter(false);
    }
  }, [bulkSelectedConfirm, deadLetterResetReason, loadDeadLetterPreview, loadStats, logger, selectedDeadLetterConnectionIds]);

  const loadAudit = useCallback(async (options?: { cursor?: string; append?: boolean }) => {
    const append = options?.append === true;
    if (append) {
      setIsLoadingMoreAudit(true);
    } else {
      setIsLoadingAudit(true);
    }
    setAuditError(null);

    try {
      const dateRange = buildAuditDateRange(auditDateRangePreset);
      const response = await bankConnectionService.getDeadLetterAudit({
        status: auditStatus || undefined,
        scope: auditScope || undefined,
        ...(dateRange ?? {}),
        action: 'reset_dead_letter',
        limit: AUDIT_PAGE_LIMIT,
        cursor: options?.cursor
      });

      if (!append) {
        setAuditData(response);
        return;
      }

      setAuditData((previous) => {
        if (!previous) {
          return response;
        }
        const existingIds = new Set(previous.rows.map((row) => row.id));
        const mergedRows = [...previous.rows];
        response.rows.forEach((row) => {
          if (!existingIds.has(row.id)) {
            mergedRows.push(row);
          }
        });

        return {
          ...response,
          count: mergedRows.length,
          summary: {
            requestedTotal: previous.summary.requestedTotal + response.summary.requestedTotal,
            resetTotal: previous.summary.resetTotal + response.summary.resetTotal,
            pendingCount: previous.summary.pendingCount + response.summary.pendingCount,
            completedCount: previous.summary.completedCount + response.summary.completedCount,
            failedCount: previous.summary.failedCount + response.summary.failedCount
          },
          rows: mergedRows
        };
      });
    } catch (loadError) {
      if (isBankingApiError(loadError) && (loadError.status === 403 || loadError.code === 'forbidden')) {
        setIsVisible(false);
        return;
      }
      const message = loadError instanceof Error ? loadError.message : 'Failed to load dead-letter audit rows';
      setAuditError(message);
      logger.warn('Failed to load dead-letter audit rows', loadError as Error);
    } finally {
      if (append) {
        setIsLoadingMoreAudit(false);
      } else {
        setIsLoadingAudit(false);
      }
    }
  }, [auditDateRangePreset, auditScope, auditStatus, logger]);

  const handleExportAuditCsv = useCallback(async () => {
    setIsExportingAudit(true);
    setActionFeedback(null);

    try {
      const dateRange = buildAuditDateRange(auditDateRangePreset);
      const csv = await bankConnectionService.exportDeadLetterAuditCsv({
        status: auditStatus || undefined,
        scope: auditScope || undefined,
        ...(dateRange ?? {}),
        action: 'reset_dead_letter',
        limit: AUDIT_EXPORT_LIMIT
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `banking-dead-letter-admin-audit-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
      anchor.click();
      URL.revokeObjectURL(downloadUrl);

      setActionFeedback({
        kind: 'success',
        message: 'Dead-letter audit CSV export generated.'
      });
    } catch (exportError) {
      if (isBankingApiError(exportError) && (exportError.status === 403 || exportError.code === 'forbidden')) {
        setIsVisible(false);
        return;
      }
      const message = exportError instanceof Error ? exportError.message : 'Failed to export dead-letter audit CSV';
      setActionFeedback({ kind: 'error', message });
      logger.warn('Failed to export dead-letter audit CSV', exportError as Error);
    } finally {
      setIsExportingAudit(false);
    }
  }, [auditDateRangePreset, auditScope, auditStatus, logger]);

  const handleCopyIncidentLink = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }

    setIsCopyingIncidentLink(true);
    setActionFeedback(null);

    try {
      const search = withBankingOpsUrlState(window.location.search, {
        modalOpen: true,
        onlyAboveThreshold,
        eventType: eventType.trim() || null,
        eventTypePrefix: eventType.trim() ? null : eventTypePrefix.trim() || null,
        auditOpen: true,
        auditStatus: auditStatus || null,
        auditScope: auditScope || null,
        auditDateRangePreset: auditDateRangePreset || null
      });
      const link = `${window.location.origin}${window.location.pathname}${search}${window.location.hash}`;
      await copyToClipboard(link);
      setActionFeedback({
        kind: 'success',
        message: 'Incident link copied to clipboard.'
      });
    } catch (copyError) {
      const message = copyError instanceof Error ? copyError.message : 'Failed to copy incident link';
      setActionFeedback({ kind: 'error', message });
      logger.warn('Failed to copy incident link', copyError as Error);
    } finally {
      setIsCopyingIncidentLink(false);
    }
  }, [auditDateRangePreset, auditScope, auditStatus, eventType, eventTypePrefix, logger, onlyAboveThreshold]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (!onlyAboveThreshold || !isVisible) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadStats({ silent: true });
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [isVisible, loadStats, onlyAboveThreshold]);

  useEffect(() => {
    if (!showDeadLetterResetForm || !isVisible) {
      return;
    }

    void loadDeadLetterPreview();
  }, [isVisible, loadDeadLetterPreview, showDeadLetterResetForm]);

  useEffect(() => {
    if (!showAuditPanel || !isVisible) {
      return;
    }
    void loadAudit();
  }, [isVisible, loadAudit, showAuditPanel]);

  useEffect(() => {
    if (selectedDeadLetterConnectionIds.size <= BULK_SELECTED_CONFIRM_THRESHOLD && bulkSelectedConfirm) {
      setBulkSelectedConfirm('');
    }
  }, [bulkSelectedConfirm, selectedDeadLetterConnectionIds]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextSearch = withBankingOpsUrlState(window.location.search, {
      modalOpen: true,
      onlyAboveThreshold,
      eventType: eventType.trim() || null,
      eventTypePrefix: eventType.trim() ? null : eventTypePrefix.trim() || null,
      auditOpen: showAuditPanel,
      auditStatus: showAuditPanel && auditStatus ? auditStatus : null,
      auditScope: showAuditPanel && auditScope ? auditScope : null,
      auditDateRangePreset: showAuditPanel && auditDateRangePreset ? auditDateRangePreset : null
    });
    replaceBrowserSearch(nextSearch);
  }, [auditDateRangePreset, auditScope, auditStatus, eventType, eventTypePrefix, onlyAboveThreshold, showAuditPanel]);

  if (!isVisible) {
    return null;
  }

  const canResetDeadLetter =
    deadLetterResetConfirm.trim() === RESET_ALL_CONFIRMATION &&
    deadLetterResetReason.trim().length > 0 &&
    !isResettingDeadLetter;
  const previewRows = deadLetterPreview?.rows ?? [];
  const hasSelectedPreviewRows = selectedDeadLetterConnectionIds.size > 0;
  const requiresBulkSelectedConfirmation = selectedDeadLetterConnectionIds.size > BULK_SELECTED_CONFIRM_THRESHOLD;
  const canResetSelectedDeadLetter =
    hasSelectedPreviewRows &&
    deadLetterResetReason.trim().length > 0 &&
    (!requiresBulkSelectedConfirmation || bulkSelectedConfirm.trim() === BULK_SELECTED_CONFIRMATION) &&
    !isResettingDeadLetter;
  const allPreviewRowsSelected =
    previewRows.length > 0 &&
    previewRows.every((row) => selectedDeadLetterConnectionIds.has(row.connectionId));
  const hasMoreAuditRows = Boolean(auditData?.page.hasMore && auditData.page.nextCursor);

  return (
    <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3Icon size={16} />
            Ops Alert Suppression (Admin)
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Inspect dedupe/suppression behavior for banking ops alerts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              void handleSendTestAlert();
            }}
            disabled={isSendingTestAlert}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-blue-300 dark:border-blue-700 text-xs font-medium text-blue-700 dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50"
            title="Send test alert webhook"
          >
            <SendIcon size={13} className={isSendingTestAlert ? 'animate-pulse' : ''} />
            <span>Send Test Alert</span>
          </button>
          <button
            onClick={() => {
              setShowDeadLetterResetForm((value) => !value);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-red-300 dark:border-red-700 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
            title="Reset all dead-lettered sync queue rows"
          >
            <AlertCircleIcon size={13} />
            <span>Reset Dead-Letter</span>
          </button>
          <button
            onClick={() => {
              setShowAuditPanel((value) => !value);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Inspect dead-letter reset audit history"
          >
            <FileTextIcon size={13} />
            <span>Audit Log</span>
          </button>
          <button
            onClick={() => {
              setEventType('');
              setEventTypePrefix(TRUELAYER_JWKS_CIRCUIT_EVENT_PREFIX);
              setMinSuppressed('0');
              setOnlyAboveThreshold(false);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-amber-300 dark:border-amber-700 text-xs font-medium text-amber-700 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/30"
            title="Preset filters for TrueLayer JWKS circuit-open events"
          >
            <AlertCircleIcon size={13} />
            <span>JWKS Circuit View</span>
          </button>
          <button
            onClick={() => {
              void loadStats();
            }}
            disabled={isLoading}
            className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            title="Refresh ops alert stats"
          >
            <RefreshCwIcon size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {showDeadLetterResetForm && (
        <div className="mt-4 rounded-md border border-red-300 dark:border-red-700 bg-red-50/70 dark:bg-red-900/20 p-3 space-y-3">
          <p className="text-xs text-red-800 dark:text-red-200">
            This resets retry state for dead-lettered sync rows and re-queues processing. Enter a reason and the exact confirmation token to continue.
          </p>
          <label className="block text-xs text-red-900 dark:text-red-100">
            Reason (required)
            <textarea
              value={deadLetterResetReason}
              onChange={(event) => setDeadLetterResetReason(event.target.value)}
              rows={2}
              placeholder="Incident reference, scope, and why reset is safe."
              className="mt-1 w-full rounded-md border border-red-300 dark:border-red-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100"
            />
          </label>
          <label className="block text-xs text-red-900 dark:text-red-100">
            Confirm Token
            <input
              value={deadLetterResetConfirm}
              onChange={(event) => setDeadLetterResetConfirm(event.target.value)}
              placeholder={RESET_ALL_CONFIRMATION}
              className="mt-1 w-full rounded-md border border-red-300 dark:border-red-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 font-mono"
            />
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <p className="text-xs text-red-900 dark:text-red-100 font-semibold">
                Dead-Letter Preview (up to {RESET_PREVIEW_LIMIT})
              </p>
              <p className="text-xs text-red-700 dark:text-red-200 mt-0.5">
                {deadLetterPreview
                  ? `${deadLetterPreview.count} row(s) at/above retry threshold ${deadLetterPreview.maxRetryAttempts}.`
                  : 'Load current rows before confirming reset.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void loadDeadLetterPreview();
              }}
              disabled={isLoadingDeadLetterPreview}
              className="px-2 py-1 rounded-md border border-red-300 dark:border-red-700 text-xs text-red-700 dark:text-red-200 hover:bg-red-100/80 dark:hover:bg-red-900/30 disabled:opacity-50"
            >
              {isLoadingDeadLetterPreview ? 'Loading...' : 'Refresh Preview'}
            </button>
          </div>

          <div className="rounded-md border border-red-200 dark:border-red-800 bg-white/70 dark:bg-gray-900/40 p-2 max-h-36 overflow-y-auto">
            {isLoadingDeadLetterPreview ? (
              <p className="text-xs text-gray-600 dark:text-gray-300">Loading dead-letter preview...</p>
            ) : previewRows.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <p className="text-gray-600 dark:text-gray-300">
                    Selected {selectedDeadLetterConnectionIds.size} of {previewRows.length}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (allPreviewRowsSelected) {
                        setSelectedDeadLetterConnectionIds(new Set());
                      } else {
                        setSelectedDeadLetterConnectionIds(new Set(previewRows.map((row) => row.connectionId)));
                      }
                    }}
                    className="px-2 py-1 rounded border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 hover:bg-red-100/80 dark:hover:bg-red-900/30"
                  >
                    {allPreviewRowsSelected ? 'Clear Selection' : 'Select All'}
                  </button>
                </div>
                {previewRows.map((row) => (
                  <div key={row.connectionId} className="text-xs text-gray-700 dark:text-gray-200">
                    <label className="inline-flex items-center gap-2 font-medium">
                      <input
                        type="checkbox"
                        checked={selectedDeadLetterConnectionIds.has(row.connectionId)}
                        onChange={(event) => {
                          setSelectedDeadLetterConnectionIds((previous) => {
                            const next = new Set(previous);
                            if (event.target.checked) {
                              next.add(row.connectionId);
                            } else {
                              next.delete(row.connectionId);
                            }
                            return next;
                          });
                        }}
                        aria-label={`Select ${row.connectionId}`}
                        className="rounded border-red-300 dark:border-red-700"
                      />
                      <span>
                        {row.institutionName ?? row.connectionId} ({row.connectionId})
                      </span>
                    </label>
                    <p className="text-gray-600 dark:text-gray-300">
                      Attempts: {row.queueAttempts} | Provider: {row.provider ?? 'n/a'} | Status: {row.status ?? 'n/a'}
                    </p>
                    <p className="text-gray-600 dark:text-gray-300 truncate" title={row.queueLastError ?? undefined}>
                      Last error: {row.queueLastError ?? 'none'}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400">
                      Updated: {formatTimestamp(row.updatedAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-600 dark:text-gray-300">
                No dead-letter rows currently meet retry threshold.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {requiresBulkSelectedConfirmation && (
              <label className="flex-1 text-xs text-red-900 dark:text-red-100">
                Bulk Confirm Token
                <input
                  value={bulkSelectedConfirm}
                  onChange={(event) => setBulkSelectedConfirm(event.target.value)}
                  placeholder={BULK_SELECTED_CONFIRMATION}
                  className="mt-1 w-full rounded-md border border-red-300 dark:border-red-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 font-mono"
                />
              </label>
            )}
            <button
              type="button"
              onClick={() => {
                void handleResetSelectedDeadLettered();
              }}
              disabled={!canResetSelectedDeadLetter}
              className="px-3 py-1.5 rounded-md border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 text-xs font-semibold hover:bg-red-100/80 dark:hover:bg-red-900/30 disabled:opacity-50"
            >
              {isResettingDeadLetter ? 'Resetting...' : 'Reset Selected'}
            </button>
            <button
              type="button"
              onClick={() => {
                void handleResetAllDeadLettered();
              }}
              disabled={!canResetDeadLetter}
              className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {isResettingDeadLetter ? 'Resetting...' : 'Confirm Reset'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedDeadLetterConnectionIds(new Set());
                setBulkSelectedConfirm('');
                setShowDeadLetterResetForm(false);
              }}
              className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showAuditPanel && (
        <div className="mt-4 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Dead-Letter Reset Audit</p>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Review admin reset actions, outcomes, and reason trail.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleCopyIncidentLink();
                }}
                disabled={isCopyingIncidentLink}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <LinkIcon size={12} className={isCopyingIncidentLink ? 'animate-pulse' : ''} />
                <span>Copy Incident Link</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleExportAuditCsv();
                }}
                disabled={isExportingAudit}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <DownloadIcon size={12} className={isExportingAudit ? 'animate-pulse' : ''} />
                <span>Export Audit CSV</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  void loadAudit();
                }}
                disabled={isLoadingAudit}
                className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                {isLoadingAudit ? 'Loading...' : 'Refresh Audit'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <label className="text-xs text-gray-600 dark:text-gray-300">
              Audit Status
              <select
                value={auditStatus}
                onChange={(event) => setAuditStatus(parseAuditStatusValue(event.target.value))}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">
              Audit Scope
              <select
                value={auditScope}
                onChange={(event) => setAuditScope(parseAuditScope(event.target.value))}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100"
              >
                <option value="">All</option>
                <option value="single">Single</option>
                <option value="bulk">Bulk</option>
                <option value="all_dead_lettered">All Dead-Lettered</option>
              </select>
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">
              Date Range
              <select
                value={auditDateRangePreset}
                onChange={(event) => setAuditDateRangePreset(parseAuditDateRangePreset(event.target.value))}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100"
              >
                <option value="">All Time</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                void loadAudit();
              }}
              disabled={isLoadingAudit || isLoadingMoreAudit}
              className="self-end px-3 py-2 rounded-md bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
            >
              Apply Audit Filters
            </button>
          </div>

          {auditData && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-md bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 p-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Requested Total</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{auditData.summary.requestedTotal}</p>
              </div>
              <div className="rounded-md bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 p-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Reset Total</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{auditData.summary.resetTotal}</p>
              </div>
              <div className="rounded-md bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 p-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{auditData.summary.pendingCount}</p>
              </div>
              <div className="rounded-md bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 p-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Completed</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{auditData.summary.completedCount}</p>
              </div>
              <div className="rounded-md bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 p-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Failed</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{auditData.summary.failedCount}</p>
              </div>
            </div>
          )}

          {auditError && (
            <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-2 text-xs text-red-700 dark:text-red-300">
              {auditError}
            </div>
          )}

          <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 p-2 max-h-56 overflow-y-auto space-y-2">
            {isLoadingAudit ? (
              <p className="text-xs text-gray-600 dark:text-gray-300">Loading dead-letter audit rows...</p>
            ) : auditData && auditData.rows.length > 0 ? (
              auditData.rows.map((row) => (
                <div
                  key={row.id}
                  className={`rounded-md border p-2 ${
                    row.status === 'failed'
                      ? 'border-red-200 dark:border-red-800 bg-red-50/70 dark:bg-red-900/20'
                      : row.status === 'pending'
                        ? 'border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{row.reason ?? 'No reason provided'}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                        {row.scope} | {row.status} | {row.adminClerkId}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                        Requested {row.requestedCount} | Reset {row.resetCount}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Created {formatTimestamp(row.createdAt)} | Completed {formatTimestamp(row.completedAt)}
                      </p>
                      {row.connectionIds.length > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate" title={row.connectionIds.join(', ')}>
                          Connections: {row.connectionIds.join(', ')}
                        </p>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{row.id}</p>
                  </div>
                  {row.error && (
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">{row.error}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">No audit rows match the current filter.</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {auditData?.rows.length ?? 0} rows (page size {AUDIT_PAGE_LIMIT}).
            </p>
            {hasMoreAuditRows && auditData?.page.nextCursor && (
              <button
                type="button"
                onClick={() => {
                  void loadAudit({ cursor: auditData.page.nextCursor ?? undefined, append: true });
                }}
                disabled={isLoadingMoreAudit}
                className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                {isLoadingMoreAudit ? 'Loading...' : 'Load More Audit Rows'}
              </button>
            )}
          </div>
        </div>
      )}

      <form
        className="mt-4 grid grid-cols-1 md:grid-cols-7 gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void loadStats();
        }}
      >
        <label className="text-xs text-gray-600 dark:text-gray-300">
          Event Type
          <input
            value={eventType}
            onChange={(event) => {
              setEventType(event.target.value);
              if (event.target.value.trim()) {
                setEventTypePrefix('');
              }
            }}
            placeholder="banking.dead_letter_detected"
            className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100"
          />
        </label>
        <label className="text-xs text-gray-600 dark:text-gray-300">
          Event Prefix
          <input
            value={eventTypePrefix}
            onChange={(event) => {
              setEventTypePrefix(event.target.value);
              if (event.target.value.trim()) {
                setEventType('');
              }
            }}
            placeholder={TRUELAYER_JWKS_CIRCUIT_EVENT_PREFIX}
            className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100"
          />
        </label>
        <label className="text-xs text-gray-600 dark:text-gray-300">
          Min Suppressed
          <input
            type="number"
            min={0}
            value={minSuppressed}
            onChange={(event) => setMinSuppressed(event.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100"
          />
        </label>
        <label className="text-xs text-gray-600 dark:text-gray-300">
          Rows
          <select
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100"
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </label>
        <label className="self-end flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200 pb-2">
          <input
            type="checkbox"
            checked={onlyAboveThreshold}
            onChange={(event) => setOnlyAboveThreshold(event.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          Above Threshold Only
        </label>
        <button
          type="submit"
          disabled={isLoading}
          className="self-end px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          Apply
        </button>
      </form>

      {actionFeedback && (
        <div
          className={`mt-3 p-2 rounded-md border text-xs flex items-center gap-2 ${
            actionFeedback.kind === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}
          role="status"
          aria-live="polite"
        >
          {actionFeedback.kind === 'success' ? <CheckCircleIcon size={14} /> : <AlertCircleIcon size={14} />}
          <span>{actionFeedback.message}</span>
        </div>
      )}

      {error && (
        <div className="mt-3 p-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircleIcon size={14} />
          <span>{error}</span>
        </div>
      )}

      {stats && (
        <>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-md bg-gray-50 dark:bg-gray-700/40 p-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Suppressed</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{stats.summary.totalSuppressed}</p>
            </div>
            <div className="rounded-md bg-gray-50 dark:bg-gray-700/40 p-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Max Suppressed</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{stats.summary.maxSuppressedCount}</p>
            </div>
            <div className="rounded-md bg-gray-50 dark:bg-gray-700/40 p-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Keys Tracked</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{stats.count}</p>
            </div>
            <div className="rounded-md bg-gray-50 dark:bg-gray-700/40 p-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Last Updated</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {formatTimestamp(stats.summary.mostRecentUpdatedAt)}
              </p>
            </div>
          </div>

          <div
            className={`mt-3 rounded-md border p-2 text-xs ${
              stats.threshold.enabled
                ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30'
            }`}
          >
            {stats.threshold.enabled ? (
              <span className="text-amber-800 dark:text-amber-200">
                Threshold enabled at {stats.threshold.suppressionThreshold} (notify every{' '}
                {stats.threshold.suppressionNotifyEvery}). Above threshold: {stats.summary.rowsAboveThreshold}.
              </span>
            ) : (
              <span className="text-gray-600 dark:text-gray-300">
                Threshold disabled. Set `BANKING_OPS_ALERT_SUPPRESSION_THRESHOLD` to enable escalation tracking.
              </span>
            )}
          </div>
          {onlyAboveThreshold && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Auto-refreshing every {AUTO_REFRESH_INTERVAL_MS / 1000} seconds while this filter is enabled.
            </p>
          )}

          <div className="mt-4 space-y-2">
            {stats.rows.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">No rows match the current filter.</p>
            ) : (
              stats.rows.map((row) => (
                <div
                  key={row.dedupeKey}
                  className={`rounded-md border p-2 ${
                    row.isAboveThreshold
                      ? 'border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate"
                        title={row.dedupeKey}
                      >
                        {row.dedupeKey}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{row.eventType}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Suppressed</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{row.suppressedCount}</p>
                      {row.isAboveThreshold && (
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mt-1">Above threshold</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Last sent: {formatTimestamp(row.lastSentAt)} | Updated: {formatTimestamp(row.updatedAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
