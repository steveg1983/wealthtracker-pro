import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import ImportDataModal from '../../components/ImportDataModal';
import CSVImportWizard from '../../components/CSVImportWizard';
import DuplicateDetection from '../../components/DuplicateDetection';
import ExcelExport from '../../components/ExcelExport';
import BulkTransactionEdit from '../../components/BulkTransactionEdit';
import TransactionReconciliation from '../../components/TransactionReconciliation';
import DataValidation from '../../components/DataValidation';
import { DownloadIcon, DeleteIcon, AlertCircleIcon, UploadIcon, DatabaseIcon, FileTextIcon, SearchIcon, GridIcon, EditIcon, LinkIcon, WrenchIcon } from '../../components/icons';

export default function DataManagementSettings() {
  const { accounts, transactions, budgets, clearAllData, exportData, loadTestData, hasTestData } = useApp();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTestDataConfirm, setShowTestDataConfirm] = useState(false);
  const [showCSVImportWizard, setShowCSVImportWizard] = useState(false);
  const [showDuplicateDetection, setShowDuplicateDetection] = useState(false);
  const [showExcelExport, setShowExcelExport] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [showDataValidation, setShowDataValidation] = useState(false);

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
      <div className="bg-[#6B86B3] dark:bg-gray-700 rounded-2xl shadow p-4 mb-6">
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

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
        <div className="space-y-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <UploadIcon size={20} />
            Import Data (MNY/MBF/QIF/OFX/CSV)
          </button>

          <button
            onClick={() => setShowCSVImportWizard(true)}
            className="w-full px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
          >
            <FileTextIcon size={20} />
            Bank CSV Import Wizard
          </button>
          
          <button
            onClick={handleExportData}
            className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <DownloadIcon size={20} />
            Export Data to JSON
          </button>

          <button
            onClick={() => setShowExcelExport(true)}
            className="w-full px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
          >
            <GridIcon size={20} />
            Export to Excel (Advanced)
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
            Load Test Data
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

      {/* Import Modal */}
      <ImportDataModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />

      {/* CSV Import Wizard */}
      <CSVImportWizard
        isOpen={showCSVImportWizard}
        onClose={() => setShowCSVImportWizard(false)}
      />

      {/* Duplicate Detection */}
      <DuplicateDetection
        isOpen={showDuplicateDetection}
        onClose={() => setShowDuplicateDetection(false)}
      />

      {/* Excel Export */}
      <ExcelExport
        isOpen={showExcelExport}
        onClose={() => setShowExcelExport(false)}
      />

      {/* Bulk Edit */}
      <BulkTransactionEdit
        isOpen={showBulkEdit}
        onClose={() => setShowBulkEdit(false)}
      />

      {/* Reconciliation */}
      <TransactionReconciliation
        isOpen={showReconciliation}
        onClose={() => setShowReconciliation(false)}
      />

      {/* Data Validation */}
      <DataValidation
        isOpen={showDataValidation}
        onClose={() => setShowDataValidation(false)}
      />
    </div>
  );
}