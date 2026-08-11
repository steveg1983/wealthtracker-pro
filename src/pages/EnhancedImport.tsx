import React, { useState, useCallback, Suspense } from 'react';
import { lazyWithRecovery } from '../utils/lazyWithRecovery';
import { useApp } from '../contexts/AppContextSupabase';
import { importRulesService } from '../services/importRulesService';
import PageWrapper from '../components/PageWrapper';
import PageTip from '../components/PageTip';
import { LoadingState } from '../components/loading/LoadingState';
import { dataPort, type ImportProgress, type MsMoneyImportResult } from '../services/port';
import {
  UploadIcon,
  FolderIcon,
  FileTextIcon,
  GlobeIcon,
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
const BatchImportModal = lazyWithRecovery(() => import('../components/BatchImportModal'));
const ImportRulesManager = lazyWithRecovery(() => import('../components/ImportRulesManager'));
const MsMoneyImportModal = lazyWithRecovery(() => import('../components/MsMoneyImportModal'));
const DataMigrationWizard = lazyWithRecovery(() => import('../components/DataMigrationWizard'));
const CSVImportWizard = lazyWithRecovery(() => import('../components/CSVImportWizard'));
const OFXImportModal = lazyWithRecovery(() => import('../components/OFXImportModal'));
const QIFImportModal = lazyWithRecovery(() => import('../components/QIFImportModal'));
// The SAME dialog Settings → Data Management opens. A restore has real rules
// (empty login only, its own erase confirmation, its own partial-failure
// reporting) and two copies of those rules would eventually disagree — so this
// page borrows the one implementation rather than growing a second door.
const RestoreBackupModal = lazyWithRecovery(() => import('../components/RestoreBackupModal'));

const bankFormats = [
  'Barclays', 'HSBC', 'Lloyds', 'NatWest', 'Santander', 'Monzo', 'Starling',
  'Chase', 'Bank of America', 'Wells Fargo', 'Citibank',
  'Deutsche Bank', 'BNP Paribas', 'ING Bank', 'UniCredit',
  'DBS Bank', 'OCBC Bank', 'Commonwealth Bank', 'ANZ Bank',
  'Coinbase', 'Binance', 'Vanguard', 'Fidelity', 'PayPal'
];

export default function EnhancedImport(): React.JSX.Element {
  const { exportData } = useApp();

  const [showBatchImport, setShowBatchImport] = useState(false);
  const [showRulesManager, setShowRulesManager] = useState(false);
  const [showMsMoneyImport, setShowMsMoneyImport] = useState(false);
  const [showMigrationWizard, setShowMigrationWizard] = useState(false);
  const [showCSVImportWizard, setShowCSVImportWizard] = useState(false);
  const [showOFXImportModal, setShowOFXImportModal] = useState(false);
  const [showQIFImportModal, setShowQIFImportModal] = useState(false);
  const [showRestoreBackup, setShowRestoreBackup] = useState(false);

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

  // Run the destructive MS Money import. WHICH store it lands in is no longer
  // this page's question: it used to hold a Postgres client and read
  // `isUsingSupabase` off the context to answer it, and a page that gets that
  // wrong writes somebody's whole financial history into a browser their
  // signed-in app will never read again — and says it worked. The seam resolves
  // its own owner on the same tick as the write.
  //
  // The modal still owns the confirmation and the backup gate; this only
  // executes, and lets the importer's own message through untouched so the
  // dialog can show it.
  const executeMsMoneyImport = useCallback(async (
    result: MsMoneyImportResult,
    onProgress: (p: ImportProgress) => void
  ) => {
    await dataPort.importMsMoney(result, { onProgress });
  }, []);

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
                Every way to bring your data in — a full Microsoft Money migration, your own backup file,
                bank files, or another app.
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

        {/* ── Restore a whole backup ───────────────────────────────────
            Sits directly under the Money migration because it is the other
            whole-dataset operation, and because this is the page people come to
            with a backup file in their downloads folder. The copy has to do two
            honest jobs: separate a restore from the statement imports below it,
            and stop it reading as a contradiction of the "Replaces all current
            data" warning above — the Money import overwrites for you, a restore
            refuses to and makes you erase the login yourself first. */}
        <Section
          title="Restore a whole backup"
          description="Your own backup file, read back in. This is not another statement import."
        >
          {/* Named as the button actually reads on the Export page, and as the
              restore dialog itself names it — a page and the dialog it opens
              must not send someone looking for two different buttons. */}
          <p className="text-sm text-gray-600 dark:text-gray-400">
            A restore reads back the JSON file from <strong>Manage &rarr; Export &rarr; &ldquo;Download full
            backup (JSON)&rdquo;</strong> — every account, transaction, budget and goal in one go. It is
            not a CSV, OFX or QIF import and it cannot read a bank statement.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            It only ever writes into an <strong>empty login</strong>. Unlike the Microsoft Money
            migration above, it will not replace what is already here: if this login holds data the
            restore stops and asks you to erase it first, which is a separate confirmation you type
            out yourself.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ActionButton
              icon={UploadIcon}
              title="Restore from a backup file"
              description="A full JSON backup — into an empty login only"
              onClick={() => setShowRestoreBackup(true)}
            />
          </div>
        </Section>

        {/* ── From a bank or spreadsheet file ──────────────────────── */}
        <Section
          title="From a bank or spreadsheet file"
          description="Statements and exports you downloaded from your bank or a spreadsheet."
        >
          {/* Retired 2026-08-09: the "Guided Import Wizard" that used to headline
              this section. It promised bank detection, column mapping and
              duplicate detection, and could not import a CSV at all — its write
              step required an accountId the mapping step never produced, and it
              fired every write un-awaited while counting them as imported. The
              CSV importer below is the one that maps columns and reviews
              duplicates for real. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ActionButton icon={FileTextIcon} title="CSV Import" description="Bank statement files" onClick={() => setShowCSVImportWizard(true)} />
            <ActionButton icon={CreditCardIcon} title="OFX Import" description="Auto-matched bank data" onClick={() => setShowOFXImportModal(true)} />
            <ActionButton icon={DatabaseIcon} title="QIF Import" description="Quicken export files" onClick={() => setShowQIFImportModal(true)} />
            <ActionButton icon={FolderIcon} title="Batch Import" description="Several files, one dialog each" onClick={() => setShowBatchImport(true)} />
          </div>
        </Section>

        {/* ── From another app ─────────────────────────────────────── */}
        <Section
          title="From another app"
          description="Moving over from another money manager."
        >
          {/* Retired 2026-08-09: the "Legacy Import" tile for older MNY / MBF
              files. It scanned the file byte by byte and invented transactions
              out of anything that decoded as a float, so it produced payments
              that were never in the Money file. The Microsoft Money importer at
              the top of this page reads a .mny properly and is the only way in
              for one. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ActionButton icon={DatabaseIcon} title="Data Migration Wizard" description="Mint, Quicken, YNAB and more" onClick={() => setShowMigrationWizard(true)} />
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

      {showRestoreBackup && (
        <Suspense fallback={<LoadingState />}>
          <RestoreBackupModal
            isOpen={showRestoreBackup}
            onClose={() => setShowRestoreBackup(false)}
          />
        </Suspense>
      )}

      {showCSVImportWizard && (
        <Suspense fallback={<LoadingState />}>
          <CSVImportWizard
            isOpen={showCSVImportWizard}
            onClose={() => setShowCSVImportWizard(false)}
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

      <PageTip id="import-intro" title="Import your data" description="Migrate a Microsoft Money file, restore one of your own backups, or upload CSV, OFX, or QIF files from your bank. WealthTracker auto-detects columns and matches your existing categories." />
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
