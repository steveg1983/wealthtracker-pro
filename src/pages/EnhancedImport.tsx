import React, { useState, useCallback, lazy, Suspense } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { importRulesService } from '../services/importRulesService';
import PageWrapper from '../components/PageWrapper';
import PageTip from '../components/PageTip';
import { LoadingState } from '../components/loading/LoadingState';
import { DataService } from '../services/api/dataService';
import { supabase } from '../lib/supabase';
import { STORAGE_KEYS } from '../services/storageAdapter';
import type { MsMoneyImportResult } from '../services/import/msMoney/transform';
import type { ImportProgress } from '../services/import/msMoney/msMoneyImport';
import {
  UploadIcon,
  FolderIcon,
  FileTextIcon,
  CheckCircleIcon,
  GlobeIcon,
  PlayIcon,
  SettingsIcon,
  DatabaseIcon,
  CreditCardIcon,
  AlertCircleIcon,
  XCircleIcon,
  type IconProps
} from '../components/icons';

// Every heavy importer is lazy AND mounted only while open (see the gating
// comment above the modal block). This is the single home for bringing data
// in, so it pulls in many modals — deferring each chunk (and its hooks) until
// first use keeps the page itself light.
const EnhancedImportWizard = lazy(() => import('../components/EnhancedImportWizard'));
const BatchImportModal = lazy(() => import('../components/BatchImportModal'));
const ImportRulesManager = lazy(() => import('../components/ImportRulesManager'));
const MsMoneyImportModal = lazy(() => import('../components/MsMoneyImportModal'));
const DataMigrationWizard = lazy(() => import('../components/DataMigrationWizard'));
const ImportDataModal = lazy(() => import('../components/ImportDataModal'));
const CSVImportWizard = lazy(() => import('../components/CSVImportWizard'));
const OFXImportModal = lazy(() => import('../components/OFXImportModal'));
const QIFImportModal = lazy(() => import('../components/QIFImportModal'));

const bankFormats = [
  'Barclays', 'HSBC', 'Lloyds', 'NatWest', 'Santander', 'Monzo', 'Starling',
  'Chase', 'Bank of America', 'Wells Fargo', 'Citibank',
  'Deutsche Bank', 'BNP Paribas', 'ING Bank', 'UniCredit',
  'DBS Bank', 'OCBC Bank', 'Commonwealth Bank', 'ANZ Bank',
  'Coinbase', 'Binance', 'Vanguard', 'Fidelity', 'PayPal'
];

export default function EnhancedImport(): React.JSX.Element {
  const { exportData, isUsingSupabase } = useApp();

  const [showEnhancedWizard, setShowEnhancedWizard] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [showRulesManager, setShowRulesManager] = useState(false);
  const [showMsMoneyImport, setShowMsMoneyImport] = useState(false);
  const [showMigrationWizard, setShowMigrationWizard] = useState(false);
  const [showLegacyImport, setShowLegacyImport] = useState(false);
  const [showCSVImportWizard, setShowCSVImportWizard] = useState(false);
  const [showOFXImportModal, setShowOFXImportModal] = useState(false);
  const [showQIFImportModal, setShowQIFImportModal] = useState(false);

  const activeRules = importRulesService.getRules().filter(rule => rule.enabled);

  // The MS Money migration REPLACES everything, so the modal offers a one-click
  // JSON snapshot first. Same payload as the Export page's full-data export.
  const handleBackup = useCallback(() => {
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
  }, [exportData]);

  // Run the destructive MS Money import against the right backend: Supabase for
  // signed-in users (batched inserts under RLS), local storage otherwise. The
  // modal owns the confirmation + backup gate; this only executes.
  const executeMsMoneyImport = useCallback(async (
    result: MsMoneyImportResult,
    onProgress: (p: ImportProgress) => void
  ) => {
    const { importToCloud, importToLocalStorage } = await import('../services/import/msMoney/msMoneyImport');
    const databaseUserId = DataService.getUserIds().databaseId;
    if (isUsingSupabase && supabase && databaseUserId) {
      await importToCloud(result, supabase, databaseUserId, () => crypto.randomUUID(), { onProgress });
    } else {
      await importToLocalStorage(result, STORAGE_KEYS, { onProgress });
    }
  }, [isUsingSupabase]);

  // A total migration replaces everything — reload so the app re-reads the new
  // dataset cleanly rather than reconciling against stale in-memory state.
  const handleMsMoneyImported = useCallback(() => {
    window.setTimeout(() => window.location.reload(), 1200);
  }, []);

  // The migration wizard recommends a tool and hands off to the real importer.
  const handleWizardTool = useCallback((tool: 'csv' | 'qif' | 'ofx' | 'msmoney') => {
    setShowMigrationWizard(false);
    if (tool === 'csv') setShowCSVImportWizard(true);
    else if (tool === 'qif') setShowQIFImportModal(true);
    else if (tool === 'ofx') setShowOFXImportModal(true);
    else setShowMsMoneyImport(true);
  }, []);

  return (
    <PageWrapper title="Import Data">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-[#1a2332] dark:bg-gray-800 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Import Data</h1>
              <p className="text-white/70">
                Every way to bring your data in — a full Microsoft Money migration, bank files, or another app.
              </p>
            </div>
            <UploadIcon size={48} className="text-white/80" />
          </div>
        </div>

        {/* Microsoft Money — the first-class total-migration flow, front and centre */}
        <button
          onClick={() => setShowMsMoneyImport(true)}
          className="w-full mb-6 text-left rounded-2xl border border-[#1a2332]/15 dark:border-blue-500/30 bg-[#1a2332]/[0.03] dark:bg-blue-500/10 hover:bg-[#1a2332]/[0.06] dark:hover:bg-blue-500/20 transition-colors p-5 flex items-center gap-4"
        >
          <span className="shrink-0 grid place-items-center h-12 w-12 rounded-xl bg-[#1a2332] dark:bg-blue-600 text-white">
            <DatabaseIcon size={24} />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-gray-900 dark:text-white">Import from Microsoft Money</span>
            <span className="block text-sm text-gray-500 dark:text-gray-400">
              Migrate your entire <code>.mny</code> file — every account, transaction and transfer. Replaces all current data.
            </span>
          </span>
        </button>

        {/* ── From a bank or spreadsheet file ──────────────────────── */}
        <Section
          title="From a bank or spreadsheet file"
          description="Statements and exports you downloaded from your bank or a spreadsheet."
        >
          {/* Guided wizard gets top billing — it detects the bank format for you */}
          <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/10 p-5 mb-1">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 shrink-0 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <UploadIcon size={22} className="text-blue-700 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Guided Import Wizard</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Step-by-step import with automatic bank-format detection, smart column mapping and duplicate detection.
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <li className="flex items-center gap-2"><CheckCircleIcon size={14} className="text-blue-600" /> Automatic bank detection</li>
                  <li className="flex items-center gap-2"><CheckCircleIcon size={14} className="text-blue-600" /> Smart column mapping</li>
                  <li className="flex items-center gap-2"><CheckCircleIcon size={14} className="text-blue-600" /> Rule-based transforms</li>
                  <li className="flex items-center gap-2"><CheckCircleIcon size={14} className="text-blue-600" /> Duplicate detection</li>
                </ul>
                <button
                  onClick={() => setShowEnhancedWizard(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-[#2d3a4d] transition-colors"
                >
                  <PlayIcon size={16} />
                  Start Guided Import
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ActionButton icon={FileTextIcon} title="CSV Import" description="Bank statement files" onClick={() => setShowCSVImportWizard(true)} />
            <ActionButton icon={CreditCardIcon} title="OFX Import" description="Auto-matched bank data" onClick={() => setShowOFXImportModal(true)} />
            <ActionButton icon={DatabaseIcon} title="QIF Import" description="Quicken export files" onClick={() => setShowQIFImportModal(true)} />
            <ActionButton icon={FolderIcon} title="Batch Import" description="Several files at once" onClick={() => setShowBatchImport(true)} />
          </div>
        </Section>

        {/* ── From another app ─────────────────────────────────────── */}
        <Section
          title="From another app"
          description="Moving over from another money manager."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ActionButton icon={DatabaseIcon} title="Data Migration Wizard" description="Mint, Quicken, YNAB and more" onClick={() => setShowMigrationWizard(true)} />
            <ActionButton icon={UploadIcon} title="Legacy Import" description="Older MNY / MBF files" onClick={() => setShowLegacyImport(true)} />
          </div>
        </Section>

        {/* ── Automation ───────────────────────────────────────────── */}
        <Section
          title="Automation"
          description="Rules that categorize and transform transactions as they come in."
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {activeRules.length > 0
                ? `${activeRules.length} active rule${activeRules.length === 1 ? '' : 's'} run on every import.`
                : 'No import rules yet — create one to auto-categorize incoming transactions.'}
            </p>
            <button
              onClick={() => setShowRulesManager(true)}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <SettingsIcon size={16} />
              Manage Rules
            </button>
          </div>
        </Section>

        {/* Supported bank formats — reassurance that the file will be understood */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recognised bank formats ({bankFormats.length}+)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {bankFormats.map(bank => (
              <div key={bank} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <GlobeIcon size={14} className="text-blue-700 dark:text-blue-400 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{bank}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircleIcon size={20} className="text-blue-700 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-blue-900 dark:text-blue-100 font-medium mb-1">Don't see your bank?</p>
                <p className="text-blue-800 dark:text-blue-200">
                  Use CSV Import to map columns for any file, or create an import rule to transform data from any institution.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import modals — mounted ONLY while open. Rendering a React.lazy
          component (even closed) both downloads its chunk and runs its hooks;
          gating on the show-flag defers chunk + work to first open, with the
          Suspense fallback covering the brief load. */}
      {showMsMoneyImport && (
        <Suspense fallback={<LoadingState />}>
          <MsMoneyImportModal
            isOpen={showMsMoneyImport}
            onClose={() => setShowMsMoneyImport(false)}
            onBackup={handleBackup}
            onExecute={executeMsMoneyImport}
            onImported={handleMsMoneyImported}
          />
        </Suspense>
      )}

      {showEnhancedWizard && (
        <Suspense fallback={<LoadingState />}>
          <EnhancedImportWizard
            isOpen={showEnhancedWizard}
            onClose={() => setShowEnhancedWizard(false)}
          />
        </Suspense>
      )}

      {showCSVImportWizard && (
        <Suspense fallback={<LoadingState />}>
          <CSVImportWizard
            isOpen={showCSVImportWizard}
            onClose={() => setShowCSVImportWizard(false)}
            type="transaction"
          />
        </Suspense>
      )}

      {showOFXImportModal && (
        <Suspense fallback={<LoadingState />}>
          <OFXImportModal
            isOpen={showOFXImportModal}
            onClose={() => setShowOFXImportModal(false)}
          />
        </Suspense>
      )}

      {showQIFImportModal && (
        <Suspense fallback={<LoadingState />}>
          <QIFImportModal
            isOpen={showQIFImportModal}
            onClose={() => setShowQIFImportModal(false)}
          />
        </Suspense>
      )}

      {showBatchImport && (
        <Suspense fallback={<LoadingState />}>
          <BatchImportModal
            isOpen={showBatchImport}
            onClose={() => setShowBatchImport(false)}
          />
        </Suspense>
      )}

      {showMigrationWizard && (
        <Suspense fallback={<LoadingState />}>
          <DataMigrationWizard
            isOpen={showMigrationWizard}
            onClose={() => setShowMigrationWizard(false)}
            onOpenTool={handleWizardTool}
          />
        </Suspense>
      )}

      {showLegacyImport && (
        <Suspense fallback={<LoadingState />}>
          <ImportDataModal
            isOpen={showLegacyImport}
            onClose={() => setShowLegacyImport(false)}
          />
        </Suspense>
      )}

      {showRulesManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Import Rules & Transformations</h2>
              <button
                onClick={() => setShowRulesManager(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
                aria-label="Close import rules"
              >
                <XCircleIcon size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 88px)' }}>
              <Suspense fallback={<LoadingState />}>
                <ImportRulesManager />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      <PageTip id="import-intro" title="Import your data" description="Migrate a Microsoft Money file, or upload CSV, OFX, or QIF files from your bank. WealthTracker auto-detects columns and matches your existing categories." />
    </PageWrapper>
  );
}

/** A titled card that groups related import options — the one section shell. */
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
