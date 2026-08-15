import React, { useCallback, useMemo, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useApp } from '../contexts/AppContextSupabase';
import { dataPort } from '@data';
import {
  isEncryptedBackup,
  decryptBackupBundle,
  type EncryptedBackupEnvelope,
} from '../services/backup/encryption';
import type { BackupRestoreOutcome } from '@data';
import { createScopedLogger } from '../loggers/scopedLogger';
import { AlertTriangleIcon, CheckCircleIcon, RefreshCwIcon, UploadIcon } from './icons';
// THE FILE FORMAT, from the module that IS the file format.
//
// These came from `services/backupService` until slice 31 — which re-exports
// them, and whose first lines reach a Supabase client. That import is what kept
// this dialog, and therefore `/enhanced-import` and `/settings/data`, out of a
// device window: a walk from either page reached the cloud at IMPORT TIME,
// through a component that had no need of it. Slice 27 had already lifted the
// pure half into `backup/format.ts` precisely so that a reader could name it
// without the client; this is a reader taking it up on that.
//
// Nothing moved and nothing was re-declared: `backupService` still re-exports
// every one of these, so no other importer changed.
import {
  BACKUP_ENTITIES,
  RestoreFailedError,
  preferenceCount,
  transactionDateRange,
  validateBackupBundle,
  type BackupBundle,
  type RestoreProgress,
} from '../services/backup/format';

/**
 * Restore a backup file into this login, or into this browser.
 *
 * The shape of this dialog is dictated by one fact from the database side: a
 * restore can only go into an EMPTY login. That is not caution, it is what
 * makes the operation safe to attempt at all — nothing the user already has can
 * be mixed with the file, re-dated, or half-overwritten. The cost is that a
 * login with data in it must be erased first, and erasing is a separate
 * decision with its own confirmation. Nothing here ever wipes implicitly.
 *
 * The other thing shaping this file is that the CLOUD restore is chunked, so it
 * is not one transaction. A failure halfway leaves the login partly populated.
 * That is survivable — the login was empty, so nothing of the user's is at
 * risk — but it must be SAID, not smoothed over, or the user will go looking at
 * a half-filled app believing it is whole.
 *
 * A LOCAL restore is one IndexedDB transaction, so it cannot end up halfway and
 * the warning is not shown for it. That is a real difference between the two
 * engines rather than a wording choice, so the dialog states whichever is true
 * instead of hedging with a sentence that covers both and describes neither.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// 'locked' — a file that IS a backup and cannot yet be read, which is a
// different state from a file that cannot be restored. Conflating the two
// would put "this file cannot be restored" in front of someone whose backup is
// perfectly good and merely shut.
type Phase = 'pick' | 'locked' | 'ready' | 'wiping' | 'restoring' | 'done' | 'failed';

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
  const { refreshAccountsAndTransactions, refreshCategories, capabilities } = useApp();

  const [phase, setPhase] = useState<Phase>('pick');
  const [fileName, setFileName] = useState('');
  const [fileProblem, setFileProblem] = useState('');
  const [locked, setLocked] = useState<EncryptedBackupEnvelope | null>(null);
  const [password, setPassword] = useState('');
  const [passwordProblem, setPasswordProblem] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [bundle, setBundle] = useState<BackupBundle | null>(null);
  const [targetIsEmpty, setTargetIsEmpty] = useState<boolean | null>(null);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [progress, setProgress] = useState<RestoreProgress | null>(null);
  /**
   * What a finished restore looks like is the SEAM's shape, not a description
   * this file keeps beside it. The two were identical, and a second copy here
   * would have been free to drift from the one both engines actually answer
   * with — including `notStoredLocally`, the field that names what a device
   * could not keep, which is the difference between a restore and a restore
   * that quietly lost things.
   */
  const [outcome, setOutcome] = useState<BackupRestoreOutcome | null>(null);
  const [failure, setFailure] = useState<{ step: string; message: string; partiallyRestored: boolean } | null>(null);

  /**
   * WHAT THIS DIALOG STILL ASKS THE STORE, now that the seam resolves its own
   * owner: three capability questions, and no identity at all.
   *
   * It used to read `DataService.getUserIds()` — the app's last consumer of it,
   * and the last place a screen held somebody's database id in order to decide
   * anything. All three of the things it decided are properties of the STORE
   * rather than facts about a person: where a backup goes, whether a failure
   * can leave a half-filled target, and whether the target is nameable yet.
   *
   * `backupTarget` carries the first two. A restore aimed at a login is chunked
   * and can therefore stop halfway; one aimed at a device is a single IndexedDB
   * transaction and cannot. `session === 'connecting'` carries the third, and
   * it is the one with the data loss behind it: a signed-in session whose
   * database id has not resolved yet is NOT a device, and a restore started
   * there would pour the file into browser storage the signed-in app will never
   * read again.
   */
  const isCloudRestore = capabilities.backupTarget === 'login';
  const cloudSessionPending = capabilities.session === 'connecting';
  const targetName = isCloudRestore ? 'login' : 'device';

  const dateRange = useMemo(() => (bundle ? transactionDateRange(bundle) : null), [bundle]);
  const populated = useMemo(
    () => (bundle ? BACKUP_ENTITIES.filter((entity) => bundle.counts[entity] > 0) : []),
    [bundle]
  );

  /**
   * What a restore of THIS file into THIS store would have to leave behind —
   * told before the user commits, not discovered afterwards.
   *
   * ── IT ASKS THE ENGINE NOW, AND THAT IS A BUG FIX ─────────────────────────
   *
   * This used to read `LOCAL_BACKUP_BINDINGS` — a description of the BROWSER's
   * store — whenever `backupTarget !== 'login'`. A device edition matches that
   * condition and keeps all fifteen tables the format carries, so it would have
   * been told that a file's budgets, goals and dismissed suggestions could not
   * be restored. Not a cosmetic slip: a warning about DATA LOSS, false, shown to
   * somebody deciding whether to press a button.
   *
   * The question — *"what can this store not hold?"* — is a property of the
   * engine, so the engine answers it: `capabilities().cannotKeep`, which every
   * implementation fills from its own schema. There is no branch on
   * `backupTarget` left here at all, which is the other half of the fix: the
   * condition was never really about where a backup goes.
   *
   * `cannotKeep` is also the same shape, and asserted by the contract suite to
   * name the same tables, as `BackupRestoreOutcome.notStoredLocally` below — so
   * the warning before the restore and the report after it cannot disagree.
   */
  const unstorable = useMemo(() => {
    if (!bundle) return [];
    return capabilities.cannotKeep
      .filter((entry) => bundle.counts[entry.entity] > 0)
      .map((entry) => ({ label: entry.label, rows: bundle.counts[entry.entity] }));
  }, [bundle, capabilities]);
  const unstorableRows = unstorable.reduce((total, entry) => total + entry.rows, 0);
  const unstorableLabels = unstorable.map((entry) => entry.label.toLowerCase()).join(', ');

  const reset = useCallback(() => {
    setPhase('pick');
    setFileName('');
    setFileProblem('');
    setLocked(null);
    setPassword('');
    setPasswordProblem('');
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

  /**
   * Everything the restore does once it is holding a readable bundle, whether
   * that came straight off disk or out of a decrypt. Shared so an encrypted
   * backup goes through exactly the same validation, the same session check and
   * the same preflight as a plain one — the encryption is a wrapper, and must
   * not become a second, thinner path into a destructive operation.
   */
  const acceptParsed = useCallback(async (parsed: unknown): Promise<void> => {
    const validation = validateBackupBundle(parsed);
    if (!validation.ok) {
      setFileProblem(validation.problem);
      setPhase('pick');
      return;
    }

    if (cloudSessionPending) {
      setFileProblem('This session has no database identity yet, so a restore cannot be scoped to your login. Reload the page and try again.');
      setPhase('pick');
      return;
    }

    setBundle(validation.bundle);
    try {
      setTargetIsEmpty(await dataPort.financialDataIsEmpty());
      setPhase('ready');
    } catch (error) {
      restoreLogger.error('Preflight emptiness check failed', error);
      setFileProblem(error instanceof Error ? error.message : `Could not check whether this ${targetName} is empty.`);
      setPhase('pick');
    }
  }, [cloudSessionPending, targetName]);

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

    if (isEncryptedBackup(parsed)) {
      // Deliberately BEFORE validation: the bundle is inside the ciphertext, so
      // there is nothing here to validate yet, and the checks below would all
      // report the wrong fault.
      setLocked(parsed);
      setPhase('locked');
      return;
    }

    await acceptParsed(parsed);
  }, [acceptParsed]);

  const handleUnlock = useCallback(async () => {
    if (!locked || password === '') return;
    setUnlocking(true);
    setPasswordProblem('');
    try {
      const bundle = await decryptBackupBundle(locked, password);
      setLocked(null);
      setPassword('');
      await acceptParsed(bundle);
    } catch (error) {
      // The message comes from the decrypt, which names both possible faults
      // and claims neither — AES-GCM genuinely cannot tell them apart.
      setPasswordProblem(
        error instanceof Error ? error.message : 'That password did not open the file.'
      );
    } finally {
      setUnlocking(false);
    }
  }, [locked, password, acceptParsed]);

  const handleWipe = useCallback(async () => {
    if (cloudSessionPending) return;
    setPhase('wiping');
    setFailure(null);
    try {
      // THE PHRASE IS THIS SCREEN'S, and it still has to be typed exactly: the
      // button above is disabled until it is, character for character, and this
      // dialog never wipes implicitly. What changed is that the phrase is no
      // longer carried down to an engine — the seam's wipe supplies whatever
      // its own store demands, which is what lets this file stop choosing
      // between two of them (and stop holding the identity it chose with).
      // The engine's own boot snapshot — which now describes history that no
      // longer exists — is dropped INSIDE this call, and has been since the
      // mount slice moved it there out of `AppContextSupabase`. This dialog was
      // clearing it a second time, which was harmless and was still a component
      // holding a fact about one implementation. The duplicate is gone.
      await dataPort.wipeAllFinancialData();
      setTargetIsEmpty(await dataPort.financialDataIsEmpty());
      setWipeConfirmText('');
      setPhase('ready');
    } catch (error) {
      restoreLogger.error('Wipe before restore failed', error);
      setFailure({
        step: `Erasing this ${targetName}`,
        message: error instanceof Error ? error.message : String(error),
        partiallyRestored: false,
      });
      setPhase('failed');
    }
  }, [cloudSessionPending, targetName]);

  const handleRestore = useCallback(async () => {
    if (!bundle || cloudSessionPending) return;
    setPhase('restoring');
    setFailure(null);
    setProgress(null);
    try {
      // The engine's own boot-snapshot cache is dropped INSIDE this call now
      // (see `DataServiceImpl.restoreBackup`). This dialog used to clear it
      // here, which meant a component holding a fact about one implementation —
      // and, measurably, the last cloud module a device window could reach from
      // `/enhanced-import` and `/settings/data`.
      const result = await dataPort.restoreBackup(bundle, { onProgress: setProgress });
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
      // A restore that is not aimed at a login is ONE transaction — one
      // IndexedDB write in a browser, one SQLite transaction on a device — so it
      // either landed or it did not, and there is never a half-filled target to
      // warn about. That is divergence B-10, and `backupTarget` is the whole of
      // it.
      //
      // There used to be a second conjunct here, `!(error instanceof
      // LocalRestoreRefusedError)`, and it was DEAD: that error is thrown only by
      // the device backup engine, which `DataServiceImpl.restoreBackup` reaches
      // only on the branch where `backupTarget` is 'device' — so the `&&` had
      // already short-circuited every time it could have mattered. Removing it
      // is also what let this file stop importing `localBackupService`, whose
      // module scope reaches the browser's storage adapter and which a device
      // window has no use for.
      setFailure({
        step,
        message,
        partiallyRestored: isCloudRestore,
      });
      setPhase('failed');
    }
  }, [bundle, isCloudRestore, cloudSessionPending, refreshAccountsAndTransactions, refreshCategories]);

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

        {/* ── Step 1b: the file is a backup, and it is shut ──────────────
            Its own step rather than an error on step 1. Nothing is wrong here:
            the file is exactly what it should be, and the only missing thing is
            the password. Saying "this file cannot be restored" would be false
            and would send someone looking for another copy. */}
        {phase === 'locked' && locked && (
          <div className="space-y-4">
            <div>
              <p className="text-body font-medium text-gray-900 dark:text-white">
                This backup is password-protected
              </p>
              <p className="text-body text-gray-600 dark:text-gray-400 mt-1">
                {fileName} was made on{' '}
                {new Date(locked.exportedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                . Enter the password you chose when you exported it.
              </p>
            </div>

            <div>
              <label htmlFor="restore-password" className="block text-body font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <input
                id="restore-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordProblem(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && password !== '') void handleUnlock(); }}
                disabled={unlocking}
                className="w-full max-w-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {passwordProblem && (
              <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
                <p className="text-sm text-red-700 dark:text-red-300">{passwordProblem}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { void handleUnlock(); }}
                disabled={password === '' || unlocking}
                className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-[#1a2332]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {unlocking ? 'Opening…' : 'Open backup'}
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={unlocking}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Choose a different file
              </button>
            </div>
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
              {/* Only when the file actually carries some. A line reading
                  "Preferences 0" on a file written before they were carried
                  would suggest the user had none, which is a different and
                  wrong statement. */}
              {preferenceCount(bundle) > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  Plus {formatCount(preferenceCount(bundle))} saved settings — pinned accounts and
                  reports, periods, grouping, hidden columns, archive cutoffs.
                </p>
              )}
            </div>

            {targetIsEmpty === false && (
              <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <AlertTriangleIcon className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" size={20} />
                  <div>
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                      This {targetName} already holds data, so the backup cannot go in yet
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      A restore only ever writes into an empty {targetName}. It REPLACES what is there
                      rather than merging with it, so it is refused instead of quietly throwing away
                      records you did not ask it to. To go ahead you have to erase everything in this
                      {' '}{targetName} first — accounts, transactions, budgets, goals, the lot. That
                      erasure is permanent and this backup file is the only way back, so keep it
                      somewhere safe before you start.
                    </p>
                  </div>
                </div>
                <label className="block text-sm text-red-800 dark:text-red-300 mb-1">
                  Type <span className="font-mono font-bold">{CONFIRM_PHRASE}</span> to erase this {targetName}
                </label>
                <input
                  value={wipeConfirmText}
                  onChange={(e) => setWipeConfirmText(e.target.value)}
                  aria-label={`Type ${CONFIRM_PHRASE} to confirm`}
                  placeholder={CONFIRM_PHRASE}
                  className="w-full px-3 py-2 rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
                <button
                  onClick={() => { void handleWipe(); }}
                  disabled={wipeConfirmText !== CONFIRM_PHRASE}
                  className="mt-3 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Erase everything in this {targetName}
                </button>
              </div>
            )}

            {targetIsEmpty === true && (
              <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 flex items-start gap-3">
                <CheckCircleIcon className="text-green-600 dark:text-green-400 mt-0.5 shrink-0" size={20} />
                <p className="text-sm text-green-800 dark:text-green-300">
                  This {targetName} is empty, so the backup can go straight in.
                </p>
              </div>
            )}

            {/* Only when it is true AND has a consequence: a file with nothing
                in those tables has nothing to warn about, and a device is not
                worse for lacking investments it was never going to show. */}
            {!isCloudRestore && unstorableRows > 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-start gap-3">
                <AlertTriangleIcon className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" size={20} />
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  Part of this backup cannot be kept on this device — {unstorableLabels}. Everything else
                  goes in as normal, and the file keeps the rest: sign in and restore the same file there
                  to get it back.
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
                  {isCloudRestore
                    ? 'These are the row counts the database reported, not what the file claimed.'
                    : 'These are the rows now on this device.'}
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
              <li className="flex justify-between gap-4 px-4 py-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Preferences</span>
                <span className="text-gray-900 dark:text-white tabular-nums">{formatCount(outcome.preferencesRestored)}</span>
              </li>
            </ul>
            {/* Said plainly, and with what to do about it: the ledger is whole,
                so this is a small, separately fixable disappointment rather
                than a reason to start the restore again. */}
            {outcome.preferencesFailure !== null && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  Your saved settings could not be put back, so the app will open with its defaults —
                  pinned accounts, periods, grouping and archive cutoffs will need setting again.
                  Everything financial is in. Your backup file still holds them, so restoring it again
                  later will bring them back.
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-2 font-mono break-words">
                  {outcome.preferencesFailure}
                </p>
              </div>
            )}
            {/* Named, not counted: "3 investments were skipped" tells someone
                nothing they can act on, whereas knowing the file still holds
                them and where they would come back does. */}
            {outcome.notStoredLocally.length > 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  This device does not hold{' '}
                  {outcome.notStoredLocally.map((entry) => entry.label.toLowerCase()).join(', ')}, so that
                  part of the backup was not restored. It is still in the file — signing in and restoring
                  the same file there would bring it back.
                </p>
                <ul className="text-xs text-amber-800 dark:text-amber-300 mt-2 space-y-0.5">
                  {outcome.notStoredLocally.map((entry) => (
                    <li key={entry.label}>{entry.label}: {entry.absence}</li>
                  ))}
                </ul>
              </div>
            )}
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
              Accounts, transactions and categories on screen have already been refreshed. Budgets and goals
              load elsewhere in the app, so reload the page to see everything at once.
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
                  Nothing further was attempted. {isCloudRestore ? 'The database said:' : 'The reason was:'}
                </p>
              </div>
            </div>
            {/* The server's own sentence, untouched — the RPCs put a machine
                code first and a readable explanation after it, and both halves
                matter when someone has to work out what to do next. */}
            <p className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-300 font-mono break-words">
              {failure.message}
            </p>
            {failure.partiallyRestored ? (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  This login is now <strong>partly populated</strong> — some rows went in before the failure and
                  the rest did not. Do not use the app in this state and do not assume what you can see is
                  complete. To recover, erase this login and restore the same file again from the start.
                </p>
              </div>
            ) : !isCloudRestore && (
              // Worth saying plainly rather than leaving to be inferred: the
              // local restore is one IndexedDB transaction, so a failure is
              // never the frightening kind that leaves a device half-filled.
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Nothing on this device was changed — the restore is written in one go, so it either
                  lands completely or not at all. Your backup file is untouched; you can try it again.
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
