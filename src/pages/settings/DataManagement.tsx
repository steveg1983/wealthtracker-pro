import { useState, lazy, Suspense, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../contexts/AppContextSupabase';
import { DownloadIcon, DeleteIcon, AlertCircleIcon, UploadIcon, DatabaseIcon, SearchIcon, EditIcon, LinkIcon, WrenchIcon, LightbulbIcon, XCircleIcon, type IconProps } from '../../components/icons';
import { LoadingState } from '../../components/loading/LoadingState';
import { createScopedLogger } from '../../loggers/scopedLogger';
import { parseBankingOpsUrlState, replaceBrowserSearch, withBankingOpsUrlState } from '../../utils/bankingOpsUrlState';
import { DataService } from '../../services/api/dataService';
import { supabase } from '../../lib/supabase';
import { STORAGE_KEYS } from '../../services/storageAdapter';

const ArchiveManager = lazy(() => import('../../components/ArchiveManager'));

// Lazy load heavy components to reduce initial bundle size. Import and export
// tools moved to the Manage pages (see the link cards below); what remains here
// is genuine data administration — cleanup tools, backups, and the danger zone.
const DuplicateDetection = lazy(() => import('../../components/DuplicateDetection'));
const BulkTransactionEdit = lazy(() => import('../../components/BulkTransactionEdit'));
const TransactionReconciliation = lazy(() => import('../../components/TransactionReconciliation'));
const DataValidation = lazy(() => import('../../components/DataValidation'));
const SmartCategorizationSettings = lazy(() => import('../../components/SmartCategorizationSettings'));
const BankConnections = lazy(() => import('../../components/BankConnections'));
const AutomaticBackupSettings = lazy(() => import('../../components/AutomaticBackupSettings'));
const dataManagementLogger = createScopedLogger('DataManagementPage');

export default function DataManagementSettings() {
  const { accounts, transactions, budgets, clearAllData, loadTestData, hasTestData, isUsingSupabase } = useApp();
  const initialBankingOpsUrlState = useMemo(
    () => parseBankingOpsUrlState(typeof window !== 'undefined' ? window.location.search : ''),
    []
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTestDataConfirm, setShowTestDataConfirm] = useState(false);
  const [showDuplicateDetection, setShowDuplicateDetection] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [showDataValidation, setShowDataValidation] = useState(false);
  const [showSmartCategorization, setShowSmartCategorization] = useState(false);
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

  // ACTUALLY delete everything. clearAllData() only resets in-memory state —
  // on cloud the data all came back on the next load, which made the button a
  // lie. Now the same proven wipe the MS Money migration uses runs first, then
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
      await clearAllData();
      setShowDeleteConfirm(false);
      window.location.reload();
    } catch (error) {
      dataManagementLogger.error('Clear all data failed', error);
      setClearError(error instanceof Error ? error.message : 'Failed to delete data.');
      setIsClearing(false);
    }
  };

  const handleLoadTestData = () => {
    loadTestData();
    setShowTestDataConfirm(false);
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

      {hasTestData && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <AlertCircleIcon className="text-orange-600 dark:text-orange-400 mt-0.5" size={20} />
          <div>
            <p className="font-medium text-orange-800 dark:text-orange-200">Test Data Active</p>
            <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
              You currently have test data loaded. When importing real bank data, you'll be prompted to clear this test data first.
            </p>
          </div>
        </div>
      )}

      {/* ── Import & Export moved to Manage ─────────────────────────
          Bringing data in and getting it out are data-admin tasks, so they now
          live under Manage where all data tools sit together. These signposts
          keep muscle memory from dead-ending here. */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Import &amp; export moved to Manage</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Every way to bring data in or get it out now lives in one place under Manage.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LinkCard
            to="/enhanced-import"
            icon={UploadIcon}
            title="Import Data"
            description="Microsoft Money, bank files (CSV/OFX/QIF), other apps and import rules"
          />
          <LinkCard
            to="/export-manager"
            icon={DownloadIcon}
            title="Export Data"
            description="Reports, Excel, templates and a full machine-readable backup"
          />
        </div>
      </div>

      {/* Bank connection MANAGEMENT lives on the Accounts page now; this page
          keeps only the URL-driven modal below so ops alert deep links
          (banking incident emails) keep working. */}

      {/* ── Archive ────────────────────────────────────────────── */}
      <Section title="Archive" description="Keep the live register fast by hiding older, reconciled transactions. Nothing is deleted — balances and reports stay exact.">
        <Suspense fallback={<LoadingState />}>
          <ArchiveManager />
        </Suspense>
      </Section>

      {/* ── Backups ────────────────────────────────────────────── */}
      <Section title="Backups" description="Schedule automatic backups of your data.">
        <Suspense fallback={<LoadingState />}>
          <AutomaticBackupSettings />
        </Suspense>
      </Section>

      {/* ── Tools ──────────────────────────────────────────────── */}
      <Section title="Tools" description="Tidy up, reconcile, and improve your data.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ActionButton icon={LightbulbIcon} title="Smart Categorization" description="Auto-categorize with AI" onClick={() => setShowSmartCategorization(true)} />
          <ActionButton icon={SearchIcon} title="Find Duplicates" description="Detect repeated transactions" onClick={() => setShowDuplicateDetection(true)} />
          <ActionButton icon={EditIcon} title="Bulk Edit" description="Change many at once" onClick={() => setShowBulkEdit(true)} />
          <ActionButton icon={LinkIcon} title="Reconcile Accounts" description="Match against statements" onClick={() => setShowReconciliation(true)} />
          <ActionButton icon={WrenchIcon} title="Validate & Clean" description="Find and fix data issues" onClick={() => setShowDataValidation(true)} />
        </div>
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
              <span className="block text-sm font-medium text-gray-900 dark:text-white">{hasTestData ? 'Reload Test Data' : 'Load Test Data'}</span>
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

      {/* Test Data Confirmation Dialog */}
      {showTestDataConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <DatabaseIcon className="text-purple-500" size={24} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Load Test Data</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This will load sample data to help you explore the app's features. The test data includes:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mb-6">
              <li>5 sample accounts</li>
              <li>Multiple transactions</li>
              <li>Example budgets</li>
            </ul>
            <p className="text-sm text-orange-600 dark:text-orange-400 mb-6">
              Note: This will add to your existing data, not replace it.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTestDataConfirm(false)}
                className="flex-1 justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleLoadTestData}
                className="flex-1 justify-center px-4 py-2 bg-purple-700 text-white rounded-lg hover:bg-purple-800"
              >
                Load Test Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tool modals — mounted ONLY while open. Rendering a React.lazy
          component (even closed, returning null) forces its chunk to download
          AND runs its hooks: DuplicateDetection's O(n²) duplicate scan and
          DataValidation's full-data sweep were executing on every visit to
          this page. Gating on the show-flag defers chunk + work to first open
          (the Suspense fallback covers the brief load). */}

      {/* Duplicate Detection */}
      {showDuplicateDetection && (
        <Suspense fallback={<LoadingState />}>
          <DuplicateDetection
            isOpen={showDuplicateDetection}
            onClose={() => setShowDuplicateDetection(false)}
          />
        </Suspense>
      )}

      {/* Bulk Edit */}
      {showBulkEdit && (
        <Suspense fallback={<LoadingState />}>
          <BulkTransactionEdit
            isOpen={showBulkEdit}
            onClose={() => setShowBulkEdit(false)}
          />
        </Suspense>
      )}

      {/* Reconciliation */}
      {showReconciliation && (
        <Suspense fallback={<LoadingState />}>
          <TransactionReconciliation
            isOpen={showReconciliation}
            onClose={() => setShowReconciliation(false)}
          />
        </Suspense>
      )}

      {/* Data Validation */}
      {showDataValidation && (
        <Suspense fallback={<LoadingState />}>
          <DataValidation
            isOpen={showDataValidation}
            onClose={() => setShowDataValidation(false)}
          />
        </Suspense>
      )}

      {/* Smart Categorization Modal */}
      {showSmartCategorization && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Smart Categorization</h2>
              <button
                onClick={() => setShowSmartCategorization(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <XCircleIcon size={24} />
              </button>
            </div>
            <Suspense fallback={<LoadingState />}>
              <SmartCategorizationSettings />
            </Suspense>
          </div>
        </div>
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
