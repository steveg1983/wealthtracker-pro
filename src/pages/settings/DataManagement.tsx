import { useState, Suspense, useMemo } from 'react';
import { lazyWithRecovery } from '../../utils/lazyWithRecovery';
import { Link } from 'react-router-dom';
import { useApp } from '../../contexts/AppContextSupabase';
import { DownloadIcon, DeleteIcon, AlertCircleIcon, UploadIcon, DatabaseIcon, SearchIcon, XCircleIcon, type IconProps } from '../../components/icons';
import { LoadingState } from '../../components/loading/LoadingState';
import { createScopedLogger } from '../../loggers/scopedLogger';
import { parseBankingOpsUrlState, replaceBrowserSearch, withBankingOpsUrlState } from '../../utils/bankingOpsUrlState';
import { DataService } from '../../services/api/dataService';
import { supabase } from '../../lib/supabase';
import { STORAGE_KEYS } from '../../services/storageAdapter';

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
const BankConnections = lazyWithRecovery(() => import('../../components/BankConnections'));

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

export default function DataManagementSettings() {
  const { accounts, transactions, budgets, resetLoadedData, isUsingSupabase } = useApp();
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

  // ACTUALLY delete everything. The store has to be wiped first — the context's
  // resetLoadedData only forgets the loaded copy, so on cloud the data all came
  // back on the next load, which made the button a lie. The same proven wipe the
  // MS Money migration uses runs first, then the loaded snapshot is dropped, then
  // the app reloads to re-read the (empty) truth.
  const handleClearData = async () => {
    setIsClearing(true);
    setClearError('');
    try {
      const { wipeCloudData, wipeLocalData } = await import('../../services/import/msMoney/msMoneyImport');
      const databaseUserId = DataService.getUserIds().databaseId;
      if (isUsingSupabase && supabase && databaseUserId) {
        await wipeCloudData(supabase, databaseUserId);
      } else {
        wipeLocalData(STORAGE_KEYS);
      }
      await resetLoadedData();
      setShowDeleteConfirm(false);
      window.location.reload();
    } catch (error) {
      dataManagementLogger.error('Clear all data failed', error);
      setClearError(error instanceof Error ? error.message : 'Failed to delete data.');
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
            description="Every record, straight from the database, as plain JSON"
          />
          <ActionButton
            icon={UploadIcon}
            title="Restore from backup"
            description="Read a backup file back in — only into an empty login"
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
                placeholder="DELETE"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            {clearError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">{clearError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setClearConfirmText(''); setClearError(''); }}
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
                {isClearing ? 'Deleting…' : 'Delete All Data'}
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
            onClose={() => setShowDuplicateSweep(false)}
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
