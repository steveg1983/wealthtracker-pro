import React, { useCallback, useMemo, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useApp } from '../contexts/AppContextSupabase';
import { DataService } from '../services/api/dataService';
import { transactionCache } from '../services/transactionCache';
import { createScopedLogger } from '../loggers/scopedLogger';
import { AlertTriangleIcon, CheckCircleIcon, RefreshCwIcon, UploadIcon } from './icons';
import {
  BACKUP_ENTITIES,
  RestoreFailedError,
  restoreBackupBundle,
  transactionDateRange,
  userFinancialDataIsEmpty,
  validateBackupBundle,
  wipeUserFinancialData,
  type BackupBundle,
  type RestoreOutcome,
  type RestoreProgress,
} from '../services/backupService';

/**
 * Restore a backup file into this login.
 *
 * The shape of this dialog is dictated by one fact from the database side: a
 * restore can only go into an EMPTY login. That is not caution, it is what
 * makes the operation safe to attempt at all — nothing the user already has can
 * be mixed with the file, re-dated, or half-overwritten. The cost is that a
 * login with data in it must be erased first, and erasing is a separate
 * decision with its own confirmation. Nothing here ever wipes implicitly.
 *
 * The other thing shaping this file is that the restore is chunked, so it is
 * not one transaction. A failure halfway leaves the login partly populated.
 * That is survivable — the login was empty, so nothing of the user's is at
 * risk — but it must be SAID, not smoothed over, or the user will go looking at
 * a half-filled app believing it is whole.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Phase = 'pick' | 'ready' | 'wiping' | 'restoring' | 'done' | 'failed';

const CONFIRM_PHRASE = 'DELETE EVERYTHING';

/** A count with thousands separators — 50,000 reads, 50000 does not. */
const formatCount = (value: number): string => value.toLocaleString();

/** Table names become sentence-case labels for the preflight list. */
const ENTITY_LABELS: Record<string, string> = {
  accounts: 'Accounts',
  categories: 'Categories',
  transactions: 'Transactions',
  transaction_splits: 'Transaction splits',
  budgets: 'Budgets',
  goals: 'Goals',
  goal_contributions: 'Goal contributions',
  investments: 'Investments',
  investment_transactions: 'Investment transactions',
  recurring_transactions: 'Recurring transactions',
  notifications: 'Notifications',
  dashboard_layouts: 'Dashboard layouts',
  widget_preferences: 'Widget preferences',
  suggestion_dismissals: 'Dismissed suggestions',
};

const restoreLogger = createScopedLogger('RestoreBackupModal');

const formatExportedAt = (iso: string): string => {
  if (!iso) return 'unknown';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
};

export default function RestoreBackupModal({ isOpen, onClose }: Props): React.JSX.Element {
  const { refreshAccountsAndTransactions, refreshCategories } = useApp();

  const [phase, setPhase] = useState<Phase>('pick');
  const [fileName, setFileName] = useState('');
  const [fileProblem, setFileProblem] = useState('');
  const [bundle, setBundle] = useState<BackupBundle | null>(null);
  const [targetIsEmpty, setTargetIsEmpty] = useState<boolean | null>(null);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [progress, setProgress] = useState<RestoreProgress | null>(null);
  const [outcome, setOutcome] = useState<RestoreOutcome | null>(null);
  const [failure, setFailure] = useState<{ step: string; message: string; partiallyRestored: boolean } | null>(null);

  const databaseUserId = DataService.getUserIds().databaseId;

  const dateRange = useMemo(() => (bundle ? transactionDateRange(bundle) : null), [bundle]);
  const populated = useMemo(
    () => (bundle ? BACKUP_ENTITIES.filter((entity) => bundle.counts[entity] > 0) : []),
    [bundle]
  );

  const reset = useCallback(() => {
    setPhase('pick');
    setFileName('');
    setFileProblem('');
    setBundle(null);
    setTargetIsEmpty(null);
    setWipeConfirmText('');
    setProgress(null);
    setOutcome(null);
    setFailure(null);
  }, []);

  const handleClose = useCallback(() => {
    // A restore in flight must not be abandoned by a stray click — the RPC
    // calls would keep landing with nothing on screen reporting them.
    if (phase === 'restoring' || phase === 'wiping') return;
    reset();
    onClose();
  }, [phase, reset, onClose]);

  const handleFile = useCallback(async (file: File) => {
    setFileProblem('');
    setBundle(null);
    setTargetIsEmpty(null);
    setFileName(file.name);

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch (error) {
      setFileProblem(
        `${file.name} is not valid JSON, so nothing in it can be read: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }

    const validation = validateBackupBundle(parsed);
    if (!validation.ok) {
      setFileProblem(validation.problem);
      return;
    }

    if (!databaseUserId) {
      setFileProblem('This session has no database identity yet, so a restore cannot be scoped to your login. Reload the page and try again.');
      return;
    }

    setBundle(validation.bundle);
    try {
      setTargetIsEmpty(await userFinancialDataIsEmpty(databaseUserId));
      setPhase('ready');
    } catch (error) {
      restoreLogger.error('Preflight emptiness check failed', error);
      setFileProblem(error instanceof Error ? error.message : 'Could not check whether this login is empty.');
    }
  }, [databaseUserId]);

  const handleWipe = useCallback(async () => {
    if (!databaseUserId) return;
    setPhase('wiping');
    setFailure(null);
    try {
      // The typed phrase goes through untouched. Normalising it here would make
      // the user's typing decoration rather than confirmation.
      await wipeUserFinancialData(wipeConfirmText, databaseUserId);
      // The local snapshot now describes history that no longer exists. Drop it
      // before anything reads it back and merges the dead rows in.
      await transactionCache.clear();
      setTargetIsEmpty(await userFinancialDataIsEmpty(databaseUserId));
      setWipeConfirmText('');
      setPhase('ready');
    } catch (error) {
      restoreLogger.error('Wipe before restore failed', error);
      setFailure({
        step: 'Erasing this login',
        message: error instanceof Error ? error.message : String(error),
        partiallyRestored: false,
      });
      setPhase('failed');
    }
  }, [databaseUserId, wipeConfirmText]);

  const handleRestore = useCallback(async () => {
    if (!bundle || !databaseUserId) return;
    setPhase('restoring');
    setFailure(null);
    setProgress(null);
    try {
      const result = await restoreBackupBundle(bundle, databaseUserId, { onProgress: setProgress });
      await transactionCache.clear();
      await refreshAccountsAndTransactions();
      await refreshCategories();
      setOutcome(result);
      setPhase('done');
    } catch (error) {
      restoreLogger.error('Restore failed', error);
      const step = error instanceof RestoreFailedError ? error.step : 'Restoring';
      const message = error instanceof RestoreFailedError
        ? error.serverMessage
        : error instanceof Error ? error.message : String(error);
      setFailure({ step, message, partiallyRestored: true });
      setPhase('failed');
    }
  }, [bundle, databaseUserId, refreshAccountsAndTransactions, refreshCategories]);

  const percent = progress && progress.rowsTotal > 0
    ? Math.round((progress.rowsDone / progress.rowsTotal) * 100)
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Restore from backup"
      size="lg"
      closeOnBackdrop={phase !== 'restoring' && phase !== 'wiping'}
      showCloseButton={phase !== 'restoring' && phase !== 'wiping'}
    >
      <ModalBody>
        {/* ── Step 1: pick a file ─────────────────────────────────────── */}
        {(phase === 'pick' || phase === 'ready') && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Backup file
            </label>
            <input
              type="file"
              accept=".json"
              aria-label="Backup file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Clearing the input means picking the SAME file again still
                // fires onChange — otherwise a user who fixes a file on disk
                // and re-selects it gets silence.
                e.target.value = '';
                if (file) void handleFile(file);
              }}
              className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#1a2332] file:text-white hover:file:bg-[#1a2332]/90"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              The JSON file produced by Manage &rarr; Export &rarr; “Download full backup (JSON)”.
            </p>
            {fileProblem && (
              <div className="mt-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">This file cannot be restored</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{fileProblem}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: what the file holds, and what is in the way ──────── */}
        {phase === 'ready' && bundle && (
          <div className="space-y-5">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                {fileName || 'This backup'}
              </h3>
              <dl className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-3">
                <div className="flex justify-between gap-4">
                  <dt>Taken</dt>
                  <dd className="text-gray-900 dark:text-white">{formatExportedAt(bundle.exportedAt)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Schema version</dt>
                  <dd className="text-gray-900 dark:text-white font-mono text-xs">{bundle.schemaVersion}</dd>
                </div>
                {dateRange && (
                  <div className="flex justify-between gap-4">
                    <dt>Transactions span</dt>
                    <dd className="text-gray-900 dark:text-white">{dateRange.first} to {dateRange.last}</dd>
                  </div>
                )}
              </dl>
              {populated.length === 0 ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  This file holds no rows at all. Restoring it would do nothing.
                </p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {populated.map((entity) => (
                    <li key={entity} className="flex justify-between gap-4">
                      <span className="text-gray-600 dark:text-gray-400">{ENTITY_LABELS[entity] ?? entity}</span>
                      <span className="text-gray-900 dark:text-white tabular-nums">{formatCount(bundle.counts[entity])}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {targetIsEmpty === false && (
              <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <AlertTriangleIcon className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" size={20} />
                  <div>
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                      This login already holds data, so the backup cannot go in yet
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      A restore only ever writes into an empty login. Pouring a backup on top of existing
                      records would mix two datasets and re-date your history, so it is refused rather than
                      attempted. To go ahead you have to erase everything in this login first — accounts,
                      transactions, budgets, goals, the lot. That erasure is permanent and this backup file
                      is the only way back, so keep it somewhere safe before you start.
                    </p>
                  </div>
                </div>
                <label className="block text-sm text-red-800 dark:text-red-300 mb-1">
                  Type <span className="font-mono font-bold">{CONFIRM_PHRASE}</span> to erase this login
                </label>
                <input
                  value={wipeConfirmText}
                  onChange={(e) => setWipeConfirmText(e.target.value)}
                  aria-label={`Type ${CONFIRM_PHRASE} to confirm`}
                  placeholder={CONFIRM_PHRASE}
                  className="w-full px-3 py-2 rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  onClick={() => { void handleWipe(); }}
                  disabled={wipeConfirmText !== CONFIRM_PHRASE}
                  className="mt-3 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Erase everything in this login
                </button>
              </div>
            )}

            {targetIsEmpty === true && (
              <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 flex items-start gap-3">
                <CheckCircleIcon className="text-green-600 dark:text-green-400 mt-0.5 shrink-0" size={20} />
                <p className="text-sm text-green-800 dark:text-green-300">
                  This login is empty, so the backup can go straight in.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: progress ────────────────────────────────────────── */}
        {(phase === 'wiping' || phase === 'restoring') && (
          <div className="py-6">
            <div className="flex items-center gap-3 mb-4">
              <RefreshCwIcon size={20} className="animate-spin text-[var(--color-primary)]" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {phase === 'wiping' ? 'Erasing this login…' : progress?.label ?? 'Starting…'}
              </p>
            </div>
            {phase === 'restoring' && progress && (
              <>
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-primary)] transition-all duration-200"
                    style={{ width: `${percent ?? 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Step {progress.stepNumber} of {progress.stepCount}
                  {progress.rowsTotal > 0 && ` — ${formatCount(progress.rowsDone)} of ${formatCount(progress.rowsTotal)} rows`}
                </p>
              </>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              Leave this tab open until it finishes.
            </p>
          </div>
        )}

        {/* ── Step 4: what actually happened ──────────────────────────── */}
        {phase === 'done' && outcome && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="text-green-600 dark:text-green-400 mt-0.5 shrink-0" size={22} />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Restore finished</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  These are the row counts the database reported, not what the file claimed.
                </p>
              </div>
            </div>
            <ul className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {outcome.restored.filter((entry) => entry.rows > 0).map((entry) => (
                <li key={entry.label} className="flex justify-between gap-4 px-4 py-2 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{entry.label}</span>
                  <span className="text-gray-900 dark:text-white tabular-nums">{formatCount(entry.rows)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-4 px-4 py-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Transfers reconnected</span>
                <span className="text-gray-900 dark:text-white tabular-nums">{formatCount(outcome.transactionsRelinked)}</span>
              </li>
              <li className="flex justify-between gap-4 px-4 py-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Nested accounts reconnected</span>
                <span className="text-gray-900 dark:text-white tabular-nums">{formatCount(outcome.accountsRelinked)}</span>
              </li>
            </ul>
            {/* Only rendered when there is something to say. A line reading
                "0 references could not be resolved" is noise that teaches the
                user to skim past the line that will one day matter. */}
            {outcome.danglingRefs.length > 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  {formatCount(outcome.danglingRefs.length)}{' '}
                  {outcome.danglingRefs.length === 1 ? 'reference points' : 'references point'} at a row the
                  backup file does not contain — for example a transaction filed under a category that was
                  never exported. Those rows were restored with the reference left as it was rather than
                  blanked, so nothing was thrown away, but they may show as uncategorised or unlinked.
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-2">
                  First affected: {outcome.danglingRefs.slice(0, 3)
                    .map((ref) => `${ref.entity}.${ref.field}`)
                    .join(', ')}
                  {outcome.danglingRefs.length > 3 && '…'}
                </p>
              </div>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Accounts, transactions and categories on screen have already been refreshed. Budgets, goals and
              investments load elsewhere in the app, so reload the page to see everything at once.
            </p>
          </div>
        )}

        {/* ── Or what went wrong ──────────────────────────────────────── */}
        {phase === 'failed' && failure && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangleIcon className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" size={22} />
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                  Stopped at: {failure.step}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Nothing further was attempted. The database said:
                </p>
              </div>
            </div>
            {/* The server's own sentence, untouched — the RPCs put a machine
                code first and a readable explanation after it, and both halves
                matter when someone has to work out what to do next. */}
            <p className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-300 font-mono break-words">
              {failure.message}
            </p>
            {failure.partiallyRestored && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  This login is now <strong>partly populated</strong> — some rows went in before the failure and
                  the rest did not. Do not use the app in this state and do not assume what you can see is
                  complete. To recover, erase this login and restore the same file again from the start.
                </p>
              </div>
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <div className="flex justify-end gap-3">
          {phase === 'done' ? (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Close
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                Reload the app
              </button>
            </>
          ) : phase === 'failed' ? (
            <>
              <button
                onClick={reset}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Start again
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleClose}
                disabled={phase === 'restoring' || phase === 'wiping'}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={() => { void handleRestore(); }}
                disabled={phase !== 'ready' || targetIsEmpty !== true || populated.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <UploadIcon size={16} />
                Restore this backup
              </button>
            </>
          )}
        </div>
      </ModalFooter>
    </Modal>
  );
}
