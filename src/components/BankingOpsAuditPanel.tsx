import React from 'react';
import { AlertCircleIcon, CheckCircleIcon, DownloadIcon, LinkIcon, RefreshCwIcon } from './icons';
import type { DeadLetterAdminAuditResponse } from '../types/banking-api';
import { formatTimestamp, copyToClipboard, type AuditDateRangePreset, type AuditScopeValue } from './bankingOpsUtils';

interface ActionFeedback {
  kind: 'success' | 'error';
  message: string;
}

interface BankingOpsAuditPanelProps {
  auditStatus: 'pending' | 'completed' | 'failed' | '';
  setAuditStatus: (v: 'pending' | 'completed' | 'failed' | '') => void;
  auditScope: AuditScopeValue;
  setAuditScope: (v: AuditScopeValue) => void;
  auditDateRangePreset: AuditDateRangePreset;
  setAuditDateRangePreset: (v: AuditDateRangePreset) => void;
  auditData: DeadLetterAdminAuditResponse | null;
  isLoadingAudit: boolean;
  isLoadingMoreAudit: boolean;
  isExportingAudit: boolean;
  auditError: string | null;
  hasMoreAuditRows: boolean;
  loadAudit: () => void;
  loadMoreAudit: () => void;
  exportAuditCSV: () => void;
  isCopyingIncidentLink: boolean;
  setIsCopyingIncidentLink: (v: boolean) => void;
  actionFeedback: ActionFeedback | null;
  setActionFeedback: (v: ActionFeedback | null) => void;
}

export default function BankingOpsAuditPanel(props: BankingOpsAuditPanelProps): React.JSX.Element {
  const {
    auditStatus, setAuditStatus,
    auditScope, setAuditScope,
    auditDateRangePreset, setAuditDateRangePreset,
    auditData, isLoadingAudit, isLoadingMoreAudit, isExportingAudit,
    auditError, hasMoreAuditRows,
    loadAudit, loadMoreAudit, exportAuditCSV,
    isCopyingIncidentLink, setIsCopyingIncidentLink,
    actionFeedback, setActionFeedback
  } = props;

  const handleCopyIncidentLink = async (auditId: string) => {
    setIsCopyingIncidentLink(true);
    try {
      const url = new URL(window.location.href);
      url.search = '';
      url.searchParams.set('showAuditPanel', 'true');
      url.searchParams.set('auditStatus', auditStatus || '');
      await copyToClipboard(url.toString());
      setActionFeedback({ kind: 'success', message: `Copied incident link for audit ${auditId}` });
    } catch {
      setActionFeedback({ kind: 'error', message: 'Failed to copy link' });
    } finally {
      setIsCopyingIncidentLink(false);
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  return (
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
            onClick={exportAuditCSV}
            disabled={isExportingAudit || !auditData?.rows.length}
            className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1"
          >
            <DownloadIcon size={12} />
            {isExportingAudit ? 'Exporting...' : 'CSV'}
          </button>
          <button
            type="button"
            onClick={loadAudit}
            disabled={isLoadingAudit}
            className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCwIcon size={12} className={isLoadingAudit ? 'animate-spin' : ''} />
            {isLoadingAudit ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Audit filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={auditStatus}
          onChange={(e) => setAuditStatus(e.target.value as typeof auditStatus)}
          className="text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-gray-700 dark:text-gray-300"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={auditScope}
          onChange={(e) => setAuditScope(e.target.value as AuditScopeValue)}
          className="text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-gray-700 dark:text-gray-300"
        >
          <option value="">All scopes</option>
          <option value="single">Single</option>
          <option value="bulk">Bulk</option>
          <option value="all_dead_lettered">All dead-lettered</option>
        </select>
        <select
          value={auditDateRangePreset}
          onChange={(e) => setAuditDateRangePreset(e.target.value as AuditDateRangePreset)}
          className="text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-gray-700 dark:text-gray-300"
        >
          <option value="">All time</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
      </div>

      {/* Feedback */}
      {actionFeedback && (
        <div className={`text-xs rounded-md px-2 py-1.5 flex items-center gap-1.5 ${
          actionFeedback.kind === 'success'
            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
        }`}>
          {actionFeedback.kind === 'success' ? <CheckCircleIcon size={12} /> : <AlertCircleIcon size={12} />}
          {actionFeedback.message}
        </div>
      )}

      {/* Error */}
      {auditError && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md px-2 py-1.5">
          {auditError}
        </div>
      )}

      {/* Audit rows */}
      {auditData && (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {auditData.rows.length} audit entries{auditData.page.hasMore ? ' (more available)' : ''}
          </p>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {auditData.rows.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">No audit entries match filters.</p>
            ) : (
              auditData.rows.map((row) => (
                <div key={row.id} className="rounded-md border border-gray-200 dark:border-gray-700 p-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${
                      row.status === 'completed' ? 'text-green-700 dark:text-green-400' :
                      row.status === 'failed' ? 'text-red-700 dark:text-red-400' :
                      'text-yellow-700 dark:text-yellow-400'
                    }`}>
                      {row.status.toUpperCase()}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">{formatTimestamp(row.createdAt)}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyIncidentLink(row.id)}
                        disabled={isCopyingIncidentLink}
                        className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        title="Copy incident link"
                      >
                        <LinkIcon size={10} />
                      </button>
                    </div>
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Scope:</span> {row.scope} &middot;{' '}
                    <span className="font-medium">Requested:</span> {row.requestedCount} &middot;{' '}
                    <span className="font-medium">Processed:</span> {row.resetCount}
                  </div>
                  {row.reason && (
                    <div className="text-gray-500 dark:text-gray-400 italic">
                      Reason: {row.reason}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          {hasMoreAuditRows && (
            <button
              type="button"
              onClick={loadMoreAudit}
              disabled={isLoadingMoreAudit}
              className="w-full justify-center py-1.5 text-xs text-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700"
            >
              {isLoadingMoreAudit ? 'Loading more...' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
