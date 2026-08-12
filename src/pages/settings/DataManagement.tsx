import { useState, Suspense, useEffect, useMemo } from 'react';
import { lazyWithRecovery } from '../../utils/lazyWithRecovery';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { readDuplicateSweepSession, type DuplicateSweepSession } from '../../utils/duplicateSweepSession';
import { useApp } from '../../contexts/AppContextSupabase';
import { DownloadIcon, DeleteIcon, AlertCircleIcon, UploadIcon, DatabaseIcon, SearchIcon, XCircleIcon, RefreshCwIcon, type IconProps } from '../../components/icons';
import { LoadingState } from '../../components/loading/LoadingState';
import { createScopedLogger } from '../../loggers/scopedLogger';
import { parseBankingOpsUrlState, replaceBrowserSearch, withBankingOpsUrlState } from '../../utils/bankingOpsUrlState';
import { dataPort, type WipeProgress } from '@data';
// The bank-connections modal comes through `@service`, which is also where its
// lazy declaration lives now — a dynamic import is an import, and one in this
// file put Clerk in front of the whole Data page in a desktop build. See
// src/editions/service.ts.
import { BankConnections } from '@service';

const ArchiveManager = lazyWithRecovery(() => import('../../components/ArchiveManager'));

// Lazy load heavy components to reduce initial bundle size. Import and export
// tools moved to the Manage pages (see the link cards below); what remains here
// is genuine data administration — cleanup tools, backups, and the danger zone.
//
// Retired 2026-08-07: Validate & Clean, Smart Categorization, Bulk Edit and
// Reconcile Accounts. Validate & Clean was the dangerous one — it compared
// category IDs against category NAMES, so it called almost every transaction
// invalid and offered to reset them all, and since the app only loads active
// accounts it read every transaction in a closed account as orphaned and
// offered to delete it. Smart Categorization promised AI and delivered string
// matching behind a fake progress spinner. Bulk Edit and Reconcile Accounts
// went with them; real account reconciliation lives at /reconciliation.
const DuplicateSweepModal = lazyWithRecovery(() => import('../../components/DuplicateSweepModal'));

// Retired 2026-08-07: Automatic Backups. Three separate reasons, each fatal on
// its own. "Test Backup Now" returned silently when backups were disabled —
// which was the default — and then showed a success toast anyway. The payload
// it would have written reads twelve localStorage keys that the Supabase app
// never writes, so the "backup" was essentially an empty file. And "Encrypt
// Backups", on by default, generated a key, encrypted with it and threw it
// away, making its own output unreadable by anyone, forever. What replaces it
// is a real export (Manage → Export) and a real restore (below).
const RestoreBackupModal = lazyWithRecovery(() => import('../../components/RestoreBackupModal'));
const LoadTestDataModal = lazyWithRecovery(() => import('../../components/LoadTestDataModal'));
const dataManagementLogger = createScopedLogger('DataManagementPage');

/**
 * Table names as a person would say them. The wipe reports the names the
 * database uses, and "transaction_splits" on a confirmation dialog is the app
 * talking to itself.
 */
const TABLE_LABELS: Record<string, string> = {
  'transfer links': 'Disconnecting transfers',
  transaction_splits: 'Split lines',
  transactions: 'Transactions',
  budgets: 'Budgets',
  goals: 'Goals',
  accounts: 'Accounts',
  categories: 'Categories',
};

/**
 * How full the bar is: the steps already finished, plus this step's own share.
 *
 * A step with no total contributes nothing beyond the steps behind it rather
 * than jumping to full — a bar that reaches 100% and then keeps working is
 * worse than one that moves in stages.
 */
const wipePercent = (progress: WipeProgress): number => {
  const within = progress.total && progress.total > 0
    ? Math.min(1, progress.deleted / progress.total)
    : 0;
  return Math.round(((progress.step - 1 + within) / progress.stepCount) * 100);
};

export default function DataManagementSettings() {
  // `capabilities` is here for TWO SENTENCES of copy on the backup cards below:
  // whether a backup is a second copy of rows a database holds or the only copy
  // there is, and whether a restore goes into a login or into this device.
  // Nothing on this page branches on it — the wipe and the restore ask the seam.
  const { accounts, transactions, budgets, resetLoadedData, capabilities } = useApp();
  const initialBankingOpsUrlState = useMemo(
    () => parseBankingOpsUrlState(typeof window !== 'undefined' ? window.location.search : ''),
    []
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTestDataConfirm, setShowTestDataConfirm] = useState(false);
  const [showDuplicateSweep, setShowDuplicateSweep] = useState(false);
  const [showRestoreBackup, setShowRestoreBackup] = useState(false);
  const [showBankConnections, setShowBankConnections] = useState(initialBankingOpsUrlState.modalOpen);
  const [showBankConnectionsWithCriticalFilter, setShowBankConnectionsWithCriticalFilter] = useState(initialBankingOpsUrlState.onlyAboveThreshold);
  const [showBankConnectionsWithOpsEventType, setShowBankConnectionsWithOpsEventType] = useState(initialBankingOpsUrlState.eventType);
  const [showBankConnectionsWithOpsEventPrefix, setShowBankConnectionsWithOpsEventPrefix] = useState(initialBankingOpsUrlState.eventTypePrefix);
  const [showBankConnectionsWithFailedAuditFilter, setShowBankConnectionsWithFailedAuditFilter] = useState(initialBankingOpsUrlState.auditOpen);
  const [showBankConnectionsWithAuditStatus, setShowBankConnectionsWithAuditStatus] = useState(initialBankingOpsUrlState.auditStatus);
  const [showBankConnectionsWithAuditScope, setShowBankConnectionsWithAuditScope] = useState(initialBankingOpsUrlState.auditScope);
  const [showBankConnectionsWithAuditDateRangePreset, setShowBankConnectionsWithAuditDateRangePreset] = useState(initialBankingOpsUrlState.auditDateRangePreset);

  const replaceBankingOpsQueryState = (updates: Parameters<typeof withBankingOpsUrlState>[1]) => {
    if (typeof window === 'undefined') {
      return;
    }
    const nextSearch = withBankingOpsUrlState(window.location.search, updates);
    replaceBrowserSearch(nextSearch);
  };

  const [isClearing, setIsClearing] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [clearError, setClearError] = useState('');
  /**
   * What the wipe is doing right now.
   *
   * The delete used to be one statement per table, and on the owner's 51,000
   * transactions the database gave up with "canceling statement due to
   * statement timeout" — after the transfer links had been nulled and the
   * splits deleted, so the login was left in a state nothing in the app
   * produces. It is chunked now, which means it also TAKES time, and a button
   * that says "Deleting…" for four minutes reads exactly like one that has
   * hung. So it reports per table and per row, the way the restore dialog the
   * owner liked does.
   */
  const [clearProgress, setClearProgress] = useState<WipeProgress | null>(null);
  /**
   * True when the failure happened part-way through, so some rows are gone and
   * some are not. Every step is idempotent, so the recovery is to run it again
   * — which is a far more useful thing to be told than the server's message
   * alone.
   */
  const [clearPartial, setClearPartial] = useState(false);

  /**
   * Coming back from the register with the duplicate sweep's crumbs.
   *
   * The sweep sends the user out to look at a row in its own account (the only
   * place the neighbouring rows and the running balance are), and the register
   * offers "Back to Find duplicates". That way back lands HERE, carrying what
   * the dialog needs to reopen where it was — see utils/duplicateSweepSession.
   *
   * The crumbs are cleared off the history entry as soon as they are taken, so
   * a reload of this page is an ordinary visit to Data Management rather than
   * one that keeps reopening a dialog the user has since closed.
   */
  const location = useLocation();
  const navigate = useNavigate();
  const [sweepResume, setSweepResume] = useState<DuplicateSweepSession | null>(null);
  useEffect(() => {
    const session = readDuplicateSweepSession(location.state);
    if (session === null) return;
    setSweepResume(session);
    setShowDuplicateSweep(true);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, navigate]);

  // ACTUALLY delete everything. The store has to be wiped first — the context's
  // resetLoadedData only forgets the loaded copy, so on cloud the data all came
  // back on the next load, which made the button a lie. The seam's wipe runs
  // first, then the loaded snapshot is dropped, then the app reloads to re-read
  // the (empty) truth.
  //
  // This page used to choose the engine itself, and held a Postgres client to do
  // it with. It no longer knows there is more than one store: `dataPort` decides,
  // and supplies whatever confirmation phrase the engine behind it demands. The
  // dialog below is the confirmation (its button will not enable until DELETE is
  // typed), which is where a phrase somebody types belongs.
  //
  // The local branch used to call wipeLocalData, which wrote to localStorage
  // while the app reads encrypted IndexedDB — so on a demo or local session this
  // button reported success and deleted nothing at all.
  const handleClearData = async () => {
    setIsClearing(true);
    setClearError('');
    setClearPartial(false);
    setClearProgress(null);
    // A local flag, not the state above: this function is read again after
    // several awaits, and `clearProgress` there is the value from the render
    // that created it — always null. The bug that would produce is the exact
    // one this whole change exists to fix, in miniature: the user is told
    // nothing about a half-finished wipe.
    let sawProgress = false;
    try {
      await dataPort.wipeAllFinancialData({
        onProgress: (progress) => {
          sawProgress = true;
          setClearProgress(progress);
        },
      });
      await resetLoadedData();
      setShowDeleteConfirm(false);
      window.location.reload();
    } catch (error) {
      dataManagementLogger.error('Clear all data failed', error);
      setClearError(error instanceof Error ? error.message : 'Failed to delete data.');
      // Chunks commit as they go, so anything already reported is already gone.
      // A local wipe is one IndexedDB transaction and cannot be half-done, and
      // a cloud wipe that failed before its first report deleted nothing —
      // telling either of them their data is half-gone would be its own harm.
      setClearPartial(sawProgress);
      setIsClearing(false);
    }
  };

  const closeBankConnections = () => {
    setShowBankConnections(false);
    setShowBankConnectionsWithCriticalFilter(false);
    setShowBankConnectionsWithOpsEventType(undefined);
    setShowBankConnectionsWithOpsEventPrefix(undefined);
    setShowBankConnectionsWithFailedAuditFilter(false);
    setShowBankConnectionsWithAuditStatus(undefined);
    setShowBankConnectionsWithAuditScope(undefined);
    setShowBankConnectionsWithAuditDateRangePreset(undefined);
    replaceBankingOpsQueryState({
      modalOpen: false
    });
  };

  return (
    <div>
      <div className="bg-secondary dark:bg-gray-700 rounded-2xl shadow p-4 mb-6">
        <h1 className="text-3xl font-bold text-white">Data Management</h1>
      </div>

      {/* Retired 2026-08-07: the orange "Test Data Active" banner and the
          "Reload Test Data" button label. Both read a `hasTestData` flag that
          nothing could keep true to reality — delete the seeded accounts by
          hand, restore a backup over the top, or clear data on another device
          and a stored boolean still claims sample data is present. The seeded
          rows are ordinary rows; the app cannot tell them apart, so it should
          not claim to. */}

      {/* Bank connection MANAGEMENT lives on the Accounts page now; this page
          keeps only the URL-driven modal below so ops alert deep links
          (banking incident emails) keep working. */}

      {/* Section order is deliberate: the short action cards first, then the
          long Archive list, then the Danger Zone LAST — "Clear All Data" must
          never be something you scroll past on the way to anything else.
          Retired 2026-08-07: the "Import & export moved to Manage" signpost. It
          announced a move that has long since settled, and the nav already
          offers Manage. */}

      {/* ── Backup & restore ───────────────────────────────────── */}
      <Section
        title="Backup and restore"
        description="A backup is defined by its restore. Download the file from Manage → Export, and bring it back here."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LinkCard
            to="/export-manager"
            icon={DownloadIcon}
            title="Download a backup"
            description={capabilities.edition === 'cloud'
              ? 'Every record, straight from the database, as plain JSON'
              : 'Everything this browser holds, as plain JSON — the only copy there is'}
          />
          <ActionButton
            icon={UploadIcon}
            title="Restore from backup"
            description={capabilities.edition === 'cloud'
              ? 'Read a backup file back in — only into an empty login'
              : 'Read a backup file back in — only into an empty device'}
            onClick={() => setShowRestoreBackup(true)}
          />
        </div>
      </Section>

      {/* ── Tools ──────────────────────────────────────────────── */}
      <Section title="Tools" description="Tidy up your data.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ActionButton icon={SearchIcon} title="Find Duplicates" description="The same payment recorded twice" onClick={() => setShowDuplicateSweep(true)} />
        </div>
      </Section>

      {/* ── Archive ────────────────────────────────────────────── */}
      <Section title="Archive" description="Keep the live register fast by hiding older, reconciled transactions. Nothing is deleted — balances and reports stay exact.">
        <Suspense fallback={<LoadingState />}>
          <ArchiveManager />
        </Suspense>
      </Section>

      {/* ── Danger Zone ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-gray-800 shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-1">Danger Zone</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Irreversible actions — handle with care.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => setShowTestDataConfirm(true)}
            className="text-left rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors p-3 flex items-center gap-3"
          >
            <span className="shrink-0 grid place-items-center h-9 w-9 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"><DatabaseIcon size={18} /></span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-gray-900 dark:text-white">Load Test Data</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Adds sample data to explore features</span>
            </span>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-left rounded-xl border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors p-3 flex items-center gap-3"
          >
            <span className="shrink-0 grid place-items-center h-9 w-9 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"><DeleteIcon size={18} /></span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-red-700 dark:text-red-400">Clear All Data</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Permanently delete everything</span>
            </span>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircleIcon className="text-red-500" size={24} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confirm Delete All Data</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete all data? This will permanently remove:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mb-6">
              <li>{accounts.length} accounts</li>
              <li>{transactions.length} transactions</li>
              <li>{budgets.length} budgets</li>
            </ul>
            <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-4">
              This action cannot be undone!
            </p>
            <div className="mb-4">
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                Type <span className="font-mono font-bold">DELETE</span> to confirm
              </label>
              <input
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                disabled={isClearing}
                placeholder="DELETE"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-40"
              />
            </div>

            {/* Per table and per row, so a wipe that takes minutes on a large
                register never looks like one that has hung. */}
            {isClearing && clearProgress && (
              <div className="mb-4" role="status" aria-live="polite">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCwIcon size={16} className="animate-spin text-red-600 dark:text-red-400" />
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {TABLE_LABELS[clearProgress.table] ?? clearProgress.table}
                  </p>
                </div>
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full bg-red-600 transition-all duration-200"
                    style={{ width: `${wipePercent(clearProgress)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 tabular-nums">
                  Step {clearProgress.step} of {clearProgress.stepCount}
                  {' — '}
                  {clearProgress.total === undefined
                    ? `${clearProgress.deleted.toLocaleString()} rows removed`
                    : `${clearProgress.deleted.toLocaleString()} of ${clearProgress.total.toLocaleString()} rows`}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Leave this tab open until it finishes.
                </p>
              </div>
            )}

            {clearError && (
              <div className="mb-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
                <p className="text-sm text-red-800 dark:text-red-300 font-mono break-words">{clearError}</p>
                {/* The recovery, not just the failure. Every step of the wipe is
                    idempotent — deleting rows that have already gone is a no-op
                    — so running it again carries on from where it stopped. */}
                {clearPartial && (
                  <p className="text-sm text-red-800 dark:text-red-300 mt-2">
                    Some data was deleted before this stopped, and the rest is still there. Nothing is
                    broken by that and nothing needs undoing — <strong>run it again to finish</strong>.
                    It will pick up where it left off.
                  </p>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setClearConfirmText('');
                  setClearError('');
                  setClearPartial(false);
                  setClearProgress(null);
                }}
                disabled={isClearing}
                className="flex-1 justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={() => { void handleClearData(); }}
                disabled={isClearing || clearConfirmText.trim().toUpperCase() !== 'DELETE'}
                className="flex-1 justify-center px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isClearing ? 'Deleting…' : clearPartial ? 'Run it again' : 'Delete All Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load test data — the dialog owns the whole run (confirm → progress →
          what was actually created), so it is mounted only while open. */}
      {showTestDataConfirm && (
        <Suspense fallback={<LoadingState />}>
          <LoadTestDataModal
            isOpen={showTestDataConfirm}
            onClose={() => setShowTestDataConfirm(false)}
          />
        </Suspense>
      )}

      {/* Tool modals — mounted ONLY while open. Rendering a React.lazy
          component (even closed, returning null) forces its chunk to download
          AND runs its hooks: the duplicate scan was executing on every visit to
          this page. Gating on the show-flag defers chunk + work to first open
          (the Suspense fallback covers the brief load). */}

      {/* Find duplicates */}
      {showDuplicateSweep && (
        <Suspense fallback={<LoadingState />}>
          <DuplicateSweepModal
            isOpen={showDuplicateSweep}
            resume={sweepResume}
            onClose={() => {
              setShowDuplicateSweep(false);
              // Closing it ends the sitting: the next open starts fresh rather
              // than restoring a place the user has just walked away from.
              setSweepResume(null);
            }}
          />
        </Suspense>
      )}

      {/* Restore from backup */}
      {showRestoreBackup && (
        <Suspense fallback={<LoadingState />}>
          <RestoreBackupModal
            isOpen={showRestoreBackup}
            onClose={() => setShowRestoreBackup(false)}
          />
        </Suspense>
      )}

      {/* Bank Connections Modal */}
      {showBankConnections && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Bank Connections</h2>
              <button
                onClick={closeBankConnections}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XCircleIcon size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 100px)' }}>
              <Suspense fallback={<LoadingState />}>
                <BankConnections onAccountsLinked={() => {
                  // Refresh accounts/transactions if needed
                }}
                defaultOpsOnlyAboveThreshold={showBankConnectionsWithCriticalFilter}
                defaultOpsEventType={showBankConnectionsWithOpsEventType}
                defaultOpsEventTypePrefix={showBankConnectionsWithOpsEventPrefix}
                defaultOpenOpsAuditLog={showBankConnectionsWithFailedAuditFilter}
                defaultOpsAuditStatus={showBankConnectionsWithAuditStatus}
                defaultOpsAuditScope={showBankConnectionsWithAuditScope}
                defaultOpsAuditDateRangePreset={showBankConnectionsWithAuditDateRangePreset}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/** A titled card that groups related actions — the one section shell. */
function Section({ title, description, children }: {
  title: string; description: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{description}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/** The one action-button style: neutral outline, icon tile, title + hint. */
function ActionButton({ icon: Icon, title, description, onClick }: {
  icon: React.ComponentType<IconProps>; title: string; description: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 hover:border-[#1a2332]/30 dark:hover:border-blue-500/40 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors p-3 flex items-center gap-3"
    >
      <span className="shrink-0 grid place-items-center h-9 w-9 rounded-lg bg-gray-100 dark:bg-gray-700 text-[#1a2332] dark:text-blue-400">
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-900 dark:text-white">{title}</span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">{description}</span>
      </span>
    </button>
  );
}

/** Signpost to a page that used to live here — same shape as ActionButton but navigates. */
function LinkCard({ to, icon: Icon, title, description }: {
  to: string; icon: React.ComponentType<IconProps>; title: string; description: string;
}) {
  return (
    <Link
      to={to}
      className="w-full text-left rounded-xl border border-[#1a2332]/15 dark:border-blue-500/30 bg-[#1a2332]/[0.03] dark:bg-blue-500/10 hover:bg-[#1a2332]/[0.06] dark:hover:bg-blue-500/20 transition-colors p-4 flex items-center gap-3"
    >
      <span className="shrink-0 grid place-items-center h-10 w-10 rounded-lg bg-[#1a2332] dark:bg-blue-600 text-white">
        <Icon size={20} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900 dark:text-white">{title}</span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">{description}</span>
      </span>
    </Link>
  );
}
