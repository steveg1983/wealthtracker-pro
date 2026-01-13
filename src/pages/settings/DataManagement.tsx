import { useState, lazy, Suspense } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { DownloadIcon, DeleteIcon, AlertCircleIcon, UploadIcon, DatabaseIcon, FileTextIcon, SearchIcon, GridIcon, EditIcon, LinkIcon, WrenchIcon, CreditCardIcon, LightbulbIcon, XCircleIcon, FolderIcon, Building2Icon } from '../../components/icons';
import { LoadingState } from '../../components/loading/LoadingState';
import { createScopedLogger } from '../../loggers/scopedLogger';

// Lazy load heavy components to reduce initial bundle size
const DataMigrationWizard = lazy(() => import('../../components/DataMigrationWizard'));
const EnhancedExportManager = lazy(() => import('../../components/EnhancedExportManager'));
const ImportDataModal = lazy(() => import('../../components/ImportDataModal'));
const CSVImportWizard = lazy(() => import('../../components/CSVImportWizard'));
const OFXImportModal = lazy(() => import('../../components/OFXImportModal'));
const QIFImportModal = lazy(() => import('../../components/QIFImportModal'));
const DuplicateDetection = lazy(() => import('../../components/DuplicateDetection'));
const ExcelExport = lazy(() => import('../../components/ExcelExport'));
const BulkTransactionEdit = lazy(() => import('../../components/BulkTransactionEdit'));
const TransactionReconciliation = lazy(() => import('../../components/TransactionReconciliation'));
const DataValidation = lazy(() => import('../../components/DataValidation'));
const SmartCategorizationSettings = lazy(() => import('../../components/SmartCategorizationSettings'));
const BatchImportModal = lazy(() => import('../../components/BatchImportModal'));
const ImportRulesManager = lazy(() => import('../../components/ImportRulesManager'));
const BankConnections = lazy(() => import('../../components/BankConnections'));
const AutomaticBackupSettings = lazy(() => import('../../components/AutomaticBackupSettings'));
const dataManagementLogger = createScopedLogger('DataManagementPage');

export default function DataManagementSettings() {
  const { accounts, transactions, budgets, clearAllData, exportData, loadTestData, hasTestData } = useApp();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTestDataConfirm, setShowTestDataConfirm] = useState(false);
  const [showCSVImportWizard, setShowCSVImportWizard] = useState(false);
  const [showOFXImportModal, setShowOFXImportModal] = useState(false);
  const [showQIFImportModal, setShowQIFImportModal] = useState(false);
  const [showDuplicateDetection, setShowDuplicateDetection] = useState(false);
  const [showExcelExport, setShowExcelExport] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [showDataValidation, setShowDataValidation] = useState(false);
  const [showSmartCategorization, setShowSmartCategorization] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [showImportRules, setShowImportRules] = useState(false);
  const [showBankConnections, setShowBankConnections] = useState(false);
  const [showMigrationWizard, setShowMigrationWizard] = useState(false);

  const handleExportData = () => {
    const dataStr = exportData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `money-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearData = () => {
    clearAllData();
    setShowDeleteConfirm(false);
    // No need to reload - the state updates will trigger re-renders
  };

  const handleLoadTestData = () => {
    loadTestData();
    setShowTestDataConfirm(false);
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

      {/* Bank Connections */}
      <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Bank Connections</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => setShowBankConnections(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Building2Icon size={20} />
            Manage Bank Connections
          </button>
        </div>
      </div>

      <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Import Options</h3>
        
        {/* Migration Wizard - Full Width */}
        <button
          onClick={() => setShowMigrationWizard(true)}
          className="w-full mb-4 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors flex items-center justify-center gap-2 shadow-lg"
        >
          <DatabaseIcon size={20} />
          <span className="font-medium">Data Migration Wizard (Mint, Quicken, YNAB, etc.)</span>
        </button>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => setShowBatchImport(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            <FolderIcon size={20} />
            Batch Import Multiple Files
          </button>

          <button
            onClick={() => setShowCSVImportWizard(true)}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
          >
            <FileTextIcon size={20} />
            CSV Import (Bank Statements)
          </button>

          <button
            onClick={() => setShowOFXImportModal(true)}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
          >
            <CreditCardIcon size={20} />
            OFX Import (Auto Match)
          </button>

          <button
            onClick={() => setShowQIFImportModal(true)}
            className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors flex items-center justify-center gap-2"
          >
            <DatabaseIcon size={20} />
            QIF Import (Quicken)
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
          >
            <UploadIcon size={20} />
            Legacy Import (MNY/MBF)
          </button>
        </div>
      </div>

      {/* Automatic Backups Section */}
      <div className="mb-6">
        <Suspense fallback={<LoadingState />}>
          <AutomaticBackupSettings />
        </Suspense>
      </div>

      <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Export Options</h3>
        
        {/* Enhanced Export Manager - Full Width */}
        <div className="mb-4">
          <Suspense fallback={<LoadingState />}>
            <EnhancedExportManager />
          </Suspense>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={handleExportData}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <DownloadIcon size={20} />
            Quick Export (JSON)
          </button>

          <button
            onClick={() => setShowExcelExport(true)}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
          >
            <GridIcon size={20} />
            Legacy Excel Export
          </button>
        </div>
      </div>

      <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Advanced System Data Options</h3>
        
        <div className="space-y-3">
          <button
            onClick={() => setShowSmartCategorization(true)}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            <LightbulbIcon size={20} />
            Smart Categorization (AI)
          </button>

          <button
            onClick={() => setShowImportRules(true)}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
          >
            <WrenchIcon size={20} />
            Import Rules & Transformations
          </button>

          <button
            onClick={() => setShowDuplicateDetection(true)}
            className="w-full px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors flex items-center justify-center gap-2"
          >
            <SearchIcon size={20} />
            Find Duplicate Transactions
          </button>

          <button
            onClick={() => setShowBulkEdit(true)}
            className="w-full px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
          >
            <EditIcon size={20} />
            Bulk Edit Transactions
          </button>

          <button
            onClick={() => setShowReconciliation(true)}
            className="w-full px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors flex items-center justify-center gap-2"
          >
            <LinkIcon size={20} />
            Reconcile Accounts
          </button>

          <button
            onClick={() => setShowDataValidation(true)}
            className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
          >
            <WrenchIcon size={20} />
            Validate & Clean Data
          </button>

          <button
            onClick={() => setShowTestDataConfirm(true)}
            className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
          >
            <DatabaseIcon size={20} />
            {hasTestData ? 'Reload Test Data' : 'Load Test Data'}
          </button>
          
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
          >
            <DeleteIcon size={20} />
            Clear All Data
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
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
            <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-6">
              This action cannot be undone!
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleClearData}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete All Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Data Confirmation Dialog */}
      {showTestDataConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
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
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleLoadTestData}
                className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
              >
                Load Test Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Migration Wizard */}
      <Suspense fallback={<LoadingState />}>
        <DataMigrationWizard
          isOpen={showMigrationWizard}
          onClose={() => setShowMigrationWizard(false)}
          onComplete={(data) => {
            dataManagementLogger.info('Migration completed', data);
            setShowMigrationWizard(false);
          }}
        />
      </Suspense>

      {/* Import Modal */}
      <Suspense fallback={<LoadingState />}>
        <ImportDataModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
        />
      </Suspense>

      {/* Batch Import Modal */}
      <Suspense fallback={<LoadingState />}>
        <BatchImportModal
          isOpen={showBatchImport}
          onClose={() => setShowBatchImport(false)}
        />
      </Suspense>

      {/* CSV Import Wizard */}
      <Suspense fallback={<LoadingState />}>
        <CSVImportWizard
          isOpen={showCSVImportWizard}
          onClose={() => setShowCSVImportWizard(false)}
          type="transaction"
        />
      </Suspense>

      {/* OFX Import Modal */}
      <Suspense fallback={<LoadingState />}>
        <OFXImportModal
          isOpen={showOFXImportModal}
          onClose={() => setShowOFXImportModal(false)}
        />
      </Suspense>

      {/* QIF Import Modal */}
      <Suspense fallback={<LoadingState />}>
        <QIFImportModal
          isOpen={showQIFImportModal}
          onClose={() => setShowQIFImportModal(false)}
        />
      </Suspense>

      {/* Duplicate Detection */}
      <Suspense fallback={<LoadingState />}>
        <DuplicateDetection
          isOpen={showDuplicateDetection}
          onClose={() => setShowDuplicateDetection(false)}
        />
      </Suspense>

      {/* Excel Export */}
      <Suspense fallback={<LoadingState />}>
        <ExcelExport
          isOpen={showExcelExport}
          onClose={() => setShowExcelExport(false)}
        />
      </Suspense>

      {/* Bulk Edit */}
      <Suspense fallback={<LoadingState />}>
        <BulkTransactionEdit
          isOpen={showBulkEdit}
          onClose={() => setShowBulkEdit(false)}
        />
      </Suspense>

      {/* Reconciliation */}
      <Suspense fallback={<LoadingState />}>
        <TransactionReconciliation
          isOpen={showReconciliation}
          onClose={() => setShowReconciliation(false)}
        />
      </Suspense>

      {/* Data Validation */}
      <Suspense fallback={<LoadingState />}>
        <DataValidation
          isOpen={showDataValidation}
          onClose={() => setShowDataValidation(false)}
        />
      </Suspense>

      {/* Smart Categorization Modal */}
      {showSmartCategorization && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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

      {/* Import Rules Modal */}
      {showImportRules && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Import Rules & Transformations</h2>
              <button
                onClick={() => setShowImportRules(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XCircleIcon size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 100px)' }}>
              <Suspense fallback={<LoadingState />}>
                <ImportRulesManager />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      {/* Bank Connections Modal */}
      {showBankConnections && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Bank Connections</h2>
              <button
                onClick={() => setShowBankConnections(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XCircleIcon size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 100px)' }}>
              <Suspense fallback={<LoadingState />}>
                <BankConnections onAccountsLinked={() => {
                  // Refresh accounts/transactions if needed
                }} />
              </Suspense>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
