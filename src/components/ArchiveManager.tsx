/**
 * Archive manager — set how far back each account keeps transactions in the
 * live register. Soft archive: nothing is deleted, balances are untouched, and
 * reports still see everything. Investment accounts are excluded in v1.
 */
import { useMemo, useState, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { ArchiveIcon, CheckCircleIcon } from './icons';
import {
  ARCHIVE_PRESETS, resolveCutoff, countArchivable, type ArchivePreset,
} from '../utils/archive';

export default function ArchiveManager() {
  const { accounts, transactions, archiveTransactionsBefore, unarchiveAccount } = useApp();
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  const [preset, setPreset] = useState<ArchivePreset>('12m');
  const [customDate, setCustomDate] = useState('');
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);

  // Archivable accounts: open, non-investment (investments excluded in v1).
  const eligibleAccounts = useMemo(
    () => accounts.filter(a => a.isActive !== false && a.type !== 'investment'),
    [accounts]
  );

  const cutoff = useMemo(() => resolveCutoff(preset, customDate), [preset, customDate]);

  const archivedCountFor = useCallback(
    (accountId: string) => transactions.reduce((n, t) => n + (t.archived && t.accountId === accountId ? 1 : 0), 0),
    [transactions]
  );

  const handleArchive = useCallback(async (accountId: string) => {
    if (!cutoff) { showWarning('Choose a date range first.'); return; }
    setBusyAccountId(accountId);
    try {
      const count = await archiveTransactionsBefore(accountId, cutoff);
      if (count > 0) showSuccess(`Archived ${count.toLocaleString()} transaction${count === 1 ? '' : 's'}.`);
      else showInfo('No reconciled transactions to archive in that range.');
    } catch (error) {
      showError(error);
    } finally {
      setBusyAccountId(null);
    }
  }, [cutoff, archiveTransactionsBefore, showSuccess, showInfo, showWarning, showError]);

  const handleUnarchive = useCallback(async (accountId: string) => {
    setBusyAccountId(accountId);
    try {
      const count = await unarchiveAccount(accountId);
      showSuccess(`Restored ${count.toLocaleString()} transaction${count === 1 ? '' : 's'}.`);
    } catch (error) {
      showError(error);
    } finally {
      setBusyAccountId(null);
    }
  }, [unarchiveAccount, showSuccess, showError]);

  const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString();

  return (
    <div>
      {/* Cutoff selector (the Section heading already explains what archiving is) */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">Archive transactions older than</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
            {ARCHIVE_PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  preset === p.value
                    ? 'bg-[#1a2332] dark:bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              aria-label="Custom archive cutoff date"
            />
          )}
        </div>
        {cutoff && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Reconciled transactions dated on or before <span className="font-medium">{fmtDate(cutoff)}</span> will be archived.
            Unreconciled ones stay visible.
          </p>
        )}
        {preset === 'all' && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">“Keep all” archives nothing — use the Restore action to bring an account fully back.</p>
        )}
      </div>

      {/* Per-account list */}
      <div className="space-y-2">
        {eligibleAccounts.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No archivable accounts.</p>
        )}
        {eligibleAccounts.map(account => {
          const willArchive = cutoff ? countArchivable(transactions, account.id, cutoff) : 0;
          const archivedNow = archivedCountFor(account.id);
          const busy = busyAccountId === account.id;
          return (
            <div key={account.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex items-center gap-3">
              <span className="shrink-0 grid place-items-center h-9 w-9 rounded-lg bg-gray-100 dark:bg-gray-700 text-[#1a2332] dark:text-blue-400">
                <ArchiveIcon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{account.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {account.archiveThroughDate
                    ? <>Archived through {fmtDate(account.archiveThroughDate)} · {archivedNow.toLocaleString()} hidden</>
                    : 'Showing all history'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {archivedNow > 0 && (
                  <button
                    onClick={() => handleUnarchive(account.id)}
                    disabled={busy}
                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 inline-flex items-center gap-1"
                  >
                    <CheckCircleIcon size={14} /> Restore all
                  </button>
                )}
                <button
                  onClick={() => handleArchive(account.id)}
                  disabled={busy || !cutoff || willArchive === 0}
                  title={!cutoff ? 'Pick a date range above' : willArchive === 0 ? 'Nothing reconciled in that range' : `Archive ${willArchive} transaction(s)`}
                  className="px-3 py-1.5 text-sm rounded-lg bg-[#1a2332] dark:bg-blue-600 text-white hover:bg-[#2d3a4d] dark:hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                >
                  {busy ? 'Working…' : cutoff && willArchive > 0 ? `Archive ${willArchive.toLocaleString()}` : 'Archive'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
