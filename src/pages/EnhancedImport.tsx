import React, { useState } from 'react';
import { importRulesService } from '../services/importRulesService';
import PageWrapper from '../components/PageWrapper';
import EnhancedImportWizard from '../components/EnhancedImportWizard';
import BatchImportModal from '../components/BatchImportModal';
import ImportRulesManager from '../components/ImportRulesManager';
import {
  UploadIcon,
  FolderIcon,
  WrenchIcon,
  FileTextIcon,
  CheckCircleIcon,
  GlobeIcon,
  PlayIcon,
  SettingsIcon,
  RefreshCwIcon,
  AlertCircleIcon
} from '../components/icons';

export default function EnhancedImport() {
  const [showEnhancedWizard, setShowEnhancedWizard] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [showRulesManager, setShowRulesManager] = useState(false);
  
  const allRules = importRulesService.getRules();
  const activeRules = allRules.filter(rule => rule.enabled);
  
  const bankFormats = [
    'Barclays', 'HSBC', 'Lloyds', 'NatWest', 'Santander', 'Monzo', 'Starling',
    'Chase', 'Bank of America', 'Wells Fargo', 'Citibank',
    'Deutsche Bank', 'BNP Paribas', 'ING Bank', 'UniCredit',
    'DBS Bank', 'OCBC Bank', 'Commonwealth Bank', 'ANZ Bank',
    'Coinbase', 'Binance', 'Vanguard', 'Fidelity', 'PayPal'
  ];

  return (
    <PageWrapper title="Enhanced Import">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-800 dark:to-indigo-800 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Enhanced Import</h1>
              <p className="text-blue-100">
                Advanced file import with batch processing, smart bank format detection, and automated rules
              </p>
            </div>
            <div className="flex items-center gap-4">
              <UploadIcon size={48} className="text-white/80" />
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-3">
              <GlobeIcon size={20} className="text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Supported Banks</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {bankFormats.length}+
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-3">
              <FileTextIcon size={20} className="text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">File Formats</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  CSV, OFX, QIF
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-3">
              <WrenchIcon size={20} className="text-purple-600 dark:text-purple-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Import Rules</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {activeRules.length} active
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-3">
              <RefreshCwIcon size={20} className="text-orange-600 dark:text-orange-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Auto Processing</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  Smart Detection
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Import Options */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Enhanced Import Wizard */}
          <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <UploadIcon size={24} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Enhanced Import Wizard
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Step-by-step guided import with automatic bank format detection, column mapping, and rule application.
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-4">
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon size={14} className="text-green-600" />
                    Automatic bank format detection
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon size={14} className="text-green-600" />
                    Smart column mapping
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon size={14} className="text-green-600" />
                    Rule-based transformations
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon size={14} className="text-green-600" />
                    Duplicate detection
                  </li>
                </ul>
                <button
                  onClick={() => setShowEnhancedWizard(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <PlayIcon size={16} />
                  Start Enhanced Import
                </button>
              </div>
            </div>
          </div>

          {/* Batch Import */}
          <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <FolderIcon size={24} className="text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Batch File Import
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Import multiple files at once with parallel processing and comprehensive error handling.
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-4">
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon size={14} className="text-green-600" />
                    Multiple file processing
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon size={14} className="text-green-600" />
                    Drag and drop support
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon size={14} className="text-green-600" />
                    Progress tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon size={14} className="text-green-600" />
                    Error recovery
                  </li>
                </ul>
                <button
                  onClick={() => setShowBatchImport(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <FolderIcon size={16} />
                  Start Batch Import
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Import Rules Management */}
        <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Import Rules & Transformations
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Automate transaction categorization and data transformation during import.
              </p>
            </div>
            <button
              onClick={() => setShowRulesManager(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <SettingsIcon size={16} />
              Manage Rules
            </button>
          </div>
          
          {activeRules.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Active Rules ({activeRules.length}):
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeRules.slice(0, 6).map(rule => (
                  <div key={rule.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <WrenchIcon size={14} className="text-purple-600 dark:text-purple-400" />
                      <span className="font-medium text-gray-900 dark:text-white text-sm">
                        {rule.name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {rule.description || 'No description'}
                    </p>
                  </div>
                ))}
              </div>
              {activeRules.length > 6 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  And {activeRules.length - 6} more rules...
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <WrenchIcon size={48} className="mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500 dark:text-gray-400 mb-2">
                No import rules configured yet
              </p>
              <p className="text-sm text-gray-400">
                Create rules to automatically categorize and transform imported transactions
              </p>
            </div>
          )}
        </div>

        {/* Supported Bank Formats */}
        <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Supported Bank Formats ({bankFormats.length}+)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {bankFormats.map((bank, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <GlobeIcon size={14} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {bank}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircleIcon size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-blue-900 dark:text-blue-100 font-medium mb-1">
                  Don't see your bank?
                </p>
                <p className="text-blue-800 dark:text-blue-200">
                  Use the "Custom Format" option to manually map columns for any CSV file format. 
                  You can also create import rules to transform data from any financial institution.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <EnhancedImportWizard 
        isOpen={showEnhancedWizard}
        onClose={() => setShowEnhancedWizard(false)}
      />
      
      <BatchImportModal 
        isOpen={showBatchImport}
        onClose={() => setShowBatchImport(false)}
      />
      
      {showRulesManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Import Rules Manager
                </h2>
                <button
                  onClick={() => setShowRulesManager(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <AlertCircleIcon size={20} className="text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <ImportRulesManager />
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
