import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { lazyWithRecovery } from '../utils/lazyWithRecovery';
import { exportService, EXPORT_FORMAT_LABELS } from '../services/exportService';
import type { ExportFormat, ExportOptions, ExportTemplate } from '../services/exportService';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { usePeriod, PERIOD_LABELS } from '../hooks/usePeriod';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import {
  DownloadIcon,
  FileTextIcon,
  FileSpreadsheetIcon,
  PlusIcon,
  TrashIcon,
  PlayIcon,
  RefreshCwIcon,
  CheckIcon,
  AlertTriangleIcon
} from '../components/icons';
import PageWrapper from '../components/PageWrapper';
import PageTip from '../components/PageTip';
import PeriodPicker from '../components/PeriodPicker';
import { LoadingState } from '../components/loading/LoadingState';
import { createScopedLogger } from '../loggers/scopedLogger';
import { dataPort } from '@data';
// WHETHER THIS EDITION WRITES .xlsx, and the modal that does it. Through the
// seam rather than by path, for the reason `@data` is: the desktop edition does
// not write spreadsheets (owner, 1 Sep 2026 — "lose excel is fine as long as
// they can keep csv"), and an `if` around a lazy import would have removed the
// button and kept the library. `generate_context!` embeds every chunk in
// `apps/desktop/dist` into the binary, so 488 KiB of SheetJS behind a button is
// 488 KiB on the disk of somebody who never presses it. See
// docs/edition-gating.md.
import { CAN_EXPORT_SPREADSHEETS, SpreadsheetExport } from '@spreadsheet';
// From the FORMAT module, not from `backupService`: this page collects its
// bundle through `dataPort` and only needs the file's own vocabulary, while
// `backupService` opens with a Supabase client. See docs/edition-gating.md.
import { downloadBackupBundle, type ExportProgress } from '../services/backup/format';
import { encryptBackupBundle, downloadEncryptedBackup } from '../services/backup/encryption';
import { selectExportData, describeExportRange, type AccountsScope } from '../utils/exportSelection';
import { generateDataExportPDF } from '../utils/pdfExport';
import { getDateLocale } from '../utils/dateFormatter';
import {
  exportTransactionsToCSV,
  exportAccountsToCSV,
  downloadCSV,
  downloadTextFile
} from '../utils/csvExport';

// The advanced report builder (templated PDF/Excel/CSV) and the dedicated Excel
// exporter both used to live under Settings ▸ Data Management. They move here so
// every way OUT of the app is on one page. Kept lazy — moving a component must
// not turn its chunk into an always-loaded static import.
//
// The Excel exporter's `lazyWithRecovery` line stood here too until 1 Sep 2026,
// when it moved into `editions/cloud/spreadsheet.ts` whole. It is still lazy and
// still the same chunk in a browser; what changed is that a DESKTOP build now
// resolves the seam to a half that names no exporter, so neither the modal nor
// the spreadsheet writer behind it is reachable from that graph.
const EnhancedExportManager = lazyWithRecovery(() => import('../components/EnhancedExportManager'));

const exportManagerLogger = createScopedLogger('ExportManagerPage');

// Scheduled exports were removed. The "Schedule Report" control only wrote a row
// to localStorage — nothing server-side ever ran, so no report was ever
// delivered. A control that pretends to schedule erodes trust in the controls
// that DO work, so it was cut rather than carried across, and the orphaned
// scheduled-report methods were deleted from exportService with it.
//
// The History tab went the same way: it was a sentence promising that export
// history "will be displayed here", backed by nothing that ever recorded an
// export.
type ActiveTab = 'export' | 'templates';

const FORMAT_ORDER: ExportFormat[] = ['pdf', 'csv', 'qif', 'ofx'];

/**
 * QIF and OFX describe transactions grouped under the accounts they belong to.
 * Neither half is optional in the format, so the Include ticks do not apply.
 */
const isInterchangeFormat = (format: ExportFormat): boolean => format === 'qif' || format === 'ofx';

/**
 * A format's name in the dropdown — plus, in the edition that writes no .xlsx,
 * the one thing a person needs told about the one that replaces it.
 *
 * Nothing is taken away silently. A desktop buyer who came to this page for a
 * spreadsheet finds no Excel button, so the CSV option says what a CSV is for:
 * every spreadsheet on earth opens one. The web edition's label is untouched.
 */
const formatLabel = (format: ExportFormat): string =>
  format === 'csv' && !CAN_EXPORT_SPREADSHEETS
    ? `${EXPORT_FORMAT_LABELS.csv} — opens in Excel`
    : EXPORT_FORMAT_LABELS[format];

const isoDay = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export default function ExportManager(): React.JSX.Element {
  // `capabilities` is here for ONE SENTENCE of copy on the full-backup card:
  // whether the file about to be downloaded is a second copy of rows a database
  // holds, or the only copy that exists. Nothing on this page branches on it.
  const { transactions, transactionSplits, accounts, categories, capabilities } = useApp();
  const { showError, showSuccess } = useToast();
  const { displayCurrency } = useCurrencyDecimal();
  // The app-wide period control, so "last month" here means what it means on
  // every report. Persisted per surface by the hook.
  const picker = usePeriod('exportPeriod');
  const [activeTab, setActiveTab] = useState<ActiveTab>('export');
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showExcelExport, setShowExcelExport] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState<ExportProgress | null>(null);
  const [backupError, setBackupError] = useState('');
  // Password-protection is OPT-IN, and stays that way. A forgotten password
  // makes the file unopenable by anyone including us, and a backup you cannot
  // open is worse than none: you spent the months since believing you had one.
  // Plain JSON also stays genuinely useful — readable, greppable, scriptable —
  // which is most of what makes it a portability export.
  const [protectBackup, setProtectBackup] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [backupPasswordConfirm, setBackupPasswordConfirm] = useState('');
  const [isProtecting, setIsProtecting] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [includeTransactions, setIncludeTransactions] = useState(true);
  const [includeAccounts, setIncludeAccounts] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = (): void => {
    setTemplates(exportService.getTemplates());
  };

  const interchange = isInterchangeFormat(format);
  const wantsTransactions = interchange || includeTransactions;
  const wantsAccounts = interchange || includeAccounts;
  const accountsScope: AccountsScope = interchange ? 'with-transactions' : 'all';

  // ONE answer to "what goes in the file", shared by the preview panel below
  // and by the export itself. They cannot disagree because there is nothing
  // for them to disagree about.
  const selection = useMemo(
    () => selectExportData({
      transactions,
      transactionSplits,
      accounts,
      categories,
      range: picker.range,
      includeTransactions: wantsTransactions,
      includeAccounts: wantsAccounts,
      accountsScope
    }),
    [transactions, transactionSplits, accounts, categories, picker.range, wantsTransactions, wantsAccounts, accountsScope]
  );

  const rangeDescription = describeExportRange(picker.period, picker.range);
  const transactionCount = selection.transactions?.length ?? 0;
  const accountCount = selection.accounts?.length ?? 0;
  const hasSomethingToExport = transactionCount > 0 || accountCount > 0;

  const handleExport = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const stem = `wealthtracker-export-${isoDay(new Date())}`;

      if (format === 'pdf') {
        await generateDataExportPDF({
          title: 'WealthTracker export',
          dateRange: rangeDescription,
          currency: displayCurrency,
          transactions: selection.transactions ?? undefined,
          accounts: selection.accounts ?? undefined,
          filename: `${stem}.pdf`
        });
      } else if (format === 'csv') {
        // A CSV holds exactly ONE table, so each ticked section gets its own
        // well-formed file rather than being stapled below the other with a
        // second header row that no spreadsheet can read.
        if (selection.transactions) {
          downloadCSV(
            exportTransactionsToCSV(selection.transactions, accounts, categories),
            `${stem}-transactions.csv`
          );
        }
        if (selection.accounts) {
          downloadCSV(exportAccountsToCSV(selection.accounts), `${stem}-accounts.csv`);
        }
      } else if (format === 'qif') {
        const qif = exportService.exportToQIF({
          transactions: selection.transactions ?? [],
          accounts: selection.accounts ?? [],
          categories
        });
        downloadTextFile(qif, `${stem}.qif`, 'application/qif');
      } else {
        const ofx = exportService.exportToOFX({
          transactions: selection.transactions ?? [],
          accounts: selection.accounts ?? []
        });
        downloadTextFile(ofx, `${stem}.ofx`, 'application/x-ofx');
      }

      showSuccess(
        format === 'csv' && selection.transactions && selection.accounts
          ? 'Two files were written: one for transactions, one for accounts.'
          : 'Your export has been downloaded.',
        'Export ready'
      );
    } catch (error) {
      exportManagerLogger.error('Export failed', error);
      showError(error);
    } finally {
      setIsLoading(false);
    }
  };

  // GDPR Art. 20 (portability) / Art. 15 (access), and — the part that used to
  // be missing — an actual backup. This reads WHOLE ROWS out of the database
  // rather than the app's React state, because state is a lossy picture of the
  // database by design: it drops columns, skips tables with no screen behind
  // them, and renames what is left into camelCase. A file built from it could
  // never be poured back in, which is what Settings → Data Management can now
  // do with this one. See services/backupService for the contract.
  //
  // Local and demo sessions read the same file out of browser storage instead.
  // Before that they could not save their data AT ALL — every path through
  // backupService resolves a Supabase client and threw without one — which is
  // an odd thing to offer a person and then refuse. Same format, same file,
  // same restore; only where the rows come from differs.
  //
  // WHICH of those two reads this file is no longer decided here. This page
  // used to ask `DataService.getUserIds()`, branch on whether a database id
  // came back, and hand the owner to the cloud collector itself — so the one
  // question a backup must never get wrong ("whose data is in this file?") was
  // being answered by a screen. The seam resolves its own owner now, and
  // refuses in words when it cannot; all that is left here is the file and the
  // sentence to show if it could not be written.
  const handleExportEverything = async (): Promise<void> => {
    setBackupError('');
    setIsBackingUp(true);
    setBackupProgress(null);
    try {
      const bundle = await dataPort.collectBackup({ onProgress: setBackupProgress });
      if (protectBackup) {
        // Key derivation is deliberately slow — 600,000 PBKDF2 rounds, about
        // half a second — so the button has to say what it is doing or it
        // reads as hung right at the end of a long read.
        setBackupProgress(null);
        setIsProtecting(true);
        downloadEncryptedBackup(await encryptBackupBundle(bundle, backupPassword));
      } else {
        downloadBackupBundle(bundle);
      }
    } catch (error) {
      exportManagerLogger.error('Full backup failed', error);
      // Say what the database said. A half-read backup that downloads anyway is
      // the failure mode this whole feature exists to remove.
      setBackupError(error instanceof Error ? error.message : 'The backup could not be completed.');
    } finally {
      setIsBackingUp(false);
      setIsProtecting(false);
      setBackupProgress(null);
    }
  };

  /**
   * The reason the button is disabled, or null. Said out loud rather than left
   * for the user to deduce from a dead control — the same rule that governs
   * every other refusal in the app.
   *
   * Eight characters is a floor, not advice. The thing that actually protects
   * this file is the 600,000-round derivation behind it; a short password is
   * still the weak end, so the copy asks for a phrase rather than a password.
   */
  const backupPasswordProblem = useMemo((): string | null => {
    if (!protectBackup) return null;
    if (backupPassword.length === 0) return 'Enter a password to protect the file.';
    if (backupPassword.length < 8) return 'Use at least 8 characters.';
    if (backupPasswordConfirm !== backupPassword) return 'The two passwords do not match.';
    return null;
  }, [protectBackup, backupPassword, backupPasswordConfirm]);

  /**
   * Apply a template — ALL of it. The previous version overwrote the saved
   * period with the current calendar month on the way in, so the one setting
   * people most wanted to keep was the one setting a template could not hold.
   */
  const handleUseTemplate = (template: ExportTemplate): void => {
    const { options } = template;
    setFormat(options.format);
    setIncludeTransactions(options.includeTransactions);
    setIncludeAccounts(options.includeAccounts);
    if (options.range === 'custom') {
      picker.setCustomStart(options.customStart);
      picker.setCustomEnd(options.customEnd);
    }
    picker.setPeriod(options.range);
    setActiveTab('export');
  };

  const handleSaveAsTemplate = (): void => {
    const name = prompt('Enter template name:');
    if (!name) return;

    const description = prompt('Enter template description (optional):') || '';

    const options: ExportOptions = {
      range: picker.period,
      customStart: picker.period === 'custom' ? picker.customStart : '',
      customEnd: picker.period === 'custom' ? picker.customEnd : '',
      format,
      includeTransactions,
      includeAccounts
    };

    exportService.createTemplate({ name, description, options, isStarter: false });
    loadTemplates();
  };

  const handleDeleteTemplate = (id: string): void => {
    if (confirm('Are you sure you want to delete this template?')) {
      exportService.deleteTemplate(id);
      loadTemplates();
    }
  };

  const describeTemplateRange = (options: ExportOptions): string =>
    options.range === 'custom' && options.customStart && options.customEnd
      ? `${options.customStart} to ${options.customEnd}`
      : PERIOD_LABELS[options.range];

  const formatDate = (date: Date): string =>
    date.toLocaleDateString(getDateLocale(), { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <PageWrapper title="Export Data">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border border-line dark:border-gray-700 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-page font-semibold mb-2 text-gray-900 dark:text-white">Export Data</h1>
              <p className="text-body text-gray-500 dark:text-gray-400">
                {CAN_EXPORT_SPREADSHEETS
                  ? 'Generate reports, export to Excel, and save reusable export templates'
                  : 'Generate reports, export to CSV or PDF, and save reusable export templates'}
              </p>
            </div>
            {/* Decorative. Grey, not ink: the heading beside it already names the page,
                and at 48px full-contrast ink would outweigh it. Was text-white/80 — correct
                on the navy slab this card replaced, invisible on white. */}
            <DownloadIcon size={48} className="text-gray-300 dark:text-gray-600" />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 overflow-x-auto">
              <button
                onClick={() => setActiveTab('export')}
                className={`py-4 px-6 border-b-2 font-medium text-body whitespace-nowrap ${
                  activeTab === 'export'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <DownloadIcon size={16} />
                  Quick Export
                </div>
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`py-4 px-6 border-b-2 font-medium text-body whitespace-nowrap ${
                  activeTab === 'templates'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileTextIcon size={16} />
                  Templates ({templates.length})
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Quick Export Tab */}
        {activeTab === 'export' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Export Options */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <h3 className="text-card font-semibold text-gray-900 dark:text-white mb-4">Export Options</h3>

                {/* Period — the same control, and the same meaning, as every
                    report in the app. */}
                <div className="mb-6">
                  <label className="block text-body font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Period
                  </label>
                  <PeriodPicker picker={picker} label="Export period" />
                </div>

                {/* Format */}
                <div className="mb-6 max-w-sm">
                  <label
                    htmlFor="export-format"
                    className="block text-body font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Format
                  </label>
                  {/* Only the formats this page actually writes. Excel lives in
                      the Excel Export / Advanced Report tools below — where the
                      edition that has them draws them — and full JSON in the
                      full backup; offering dead options here would be the same
                      broken-control problem as the removed scheduler. */}
                  <select
                    id="export-format"
                    value={format}
                    onChange={(e) => setFormat(e.target.value as ExportFormat)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {FORMAT_ORDER.map(key => (
                      <option key={key} value={key}>{formatLabel(key)}</option>
                    ))}
                  </select>
                </div>

                {/* Include Options */}
                <div>
                  <label className="block text-body font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Include in Export
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {([
                      {
                        key: 'transactions' as const,
                        label: 'Transactions',
                        checked: wantsTransactions,
                        toggle: () => setIncludeTransactions(value => !value)
                      },
                      {
                        key: 'accounts' as const,
                        label: 'Accounts',
                        checked: wantsAccounts,
                        toggle: () => setIncludeAccounts(value => !value)
                      }
                    ]).map(({ key, label, checked, toggle }) => (
                      <button
                        key={key}
                        type="button"
                        role="switch"
                        aria-checked={checked}
                        onClick={() => { if (!interchange) toggle(); }}
                        disabled={interchange}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                          interchange ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                        } ${
                          /* The checked skin is the SELECTED state's own token —
                             `border-primary`, which index.css remaps to the
                             focus family's slate on dark where the navy would be
                             no border at all — over the tenth-strength wash the
                             account rows already wear (stock-blue ruling,
                             28 Aug).

                             Dark takes `gray-600` rather than the account rows'
                             `gray-700/50`, because THIS unchecked tile is
                             already `gray-700` on a `gray-800` card: a
                             half-strength gray-700 would land between the two
                             and read as LESS lifted than the tile it is meant to
                             outrank. One step deeper in the same family is the
                             answer the C/R chips give to the same problem. */
                          checked
                            ? 'bg-primary/10 dark:bg-gray-600 border border-primary'
                            : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-650'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                          checked ? 'bg-[#1a2332] text-white' : 'border border-gray-300 dark:border-gray-500'
                        }`}>
                          {checked && <CheckIcon size={12} />}
                        </div>
                        <span className="text-body text-gray-700 dark:text-gray-300">{label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Investments, Budgets and Charts used to sit in this row.
                      Nothing was behind any of them: investments were passed as
                      a hard-coded empty list, budgets were never passed at all,
                      and "Charts" printed the sentence "Charts would be rendered
                      here from DOM elements" into the PDF. */}
                  <p className="text-body text-gray-600 dark:text-gray-400 mt-3">
                    {interchange
                      ? 'QIF and OFX describe transactions grouped under the accounts they belong to, so both are always included — and only accounts with transactions in this period are named, to avoid creating empty ones wherever you import the file.'
                      : format === 'csv'
                        ? 'A CSV holds one table, so each ticked section is written as its own file.'
                        : `Figures are in ${displayCurrency}.`}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => { void handleExport(); }}
                  disabled={isLoading || !hasSomethingToExport}
                  className="flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? <RefreshCwIcon size={16} className="animate-spin" /> : <DownloadIcon size={16} />}
                  {isLoading ? 'Generating...' : 'Export Now'}
                </button>

                {/* Advanced, templated reports (Monthly Statement, Budget
                    Analysis) as PDF/Excel/CSV — the richer builder this quick
                    export deliberately is not. Self-contained trigger + modal. */}
                <Suspense fallback={<LoadingState />}>
                  <EnhancedExportManager />
                </Suspense>

                {/* ABSENT, not disabled, in the edition that writes no .xlsx —
                    the bank-feeds lesson (owner, 26 Aug): a control whose action
                    cannot exist here is a control to leave out, because a dead
                    one makes a person wonder what they did wrong. The CSV option
                    above carries the sentence that replaces it. */}
                {CAN_EXPORT_SPREADSHEETS && (
                  <button
                    onClick={() => setShowExcelExport(true)}
                    className="flex items-center gap-2 px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <FileSpreadsheetIcon size={16} />
                    Excel Export
                  </button>
                )}

                <button
                  onClick={handleSaveAsTemplate}
                  className="flex items-center gap-2 px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <FileTextIcon size={16} />
                  Save as Template
                </button>

                {/* NOTE: no "Schedule Report" button here by design — see the
                    scheduled-exports comment at the top of this file. */}
              </div>

              {/* ── The full backup ──────────────────────────────────────
                  Given its own card rather than a slot in the button row
                  above: it is the only export that can be RESTORED, and the
                  only one that puts a readable copy of the user's entire
                  financial life on their disk. Both facts need saying where
                  the button is, not in a tooltip. */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <h3 className="text-page font-bold text-gray-900 dark:text-white">Full backup</h3>
                <p className="text-body text-gray-600 dark:text-gray-400 mt-1 mb-4">
                  {capabilities.edition === 'cloud'
                    ? 'Every record we hold for you, straight from the database — accounts, transactions, splits, categories, budgets, goals, investments and the rest.'
                    : 'Everything this browser is holding — accounts, transactions, splits, categories, budgets and goals. Nothing here has been sent anywhere, so this file is the only copy that exists.'}
                  {' '}This is the only export that can be restored: Manage &rarr; Import Data
                  &rarr; Full restore reads it back. It also satisfies a data-portability request.
                </p>

                {/* CONDITIONAL, and that is Claude Design's ruling rather than a
                    convenience (answers of 15 Aug, §1). This is a WARNING, not a
                    caveat: a caveat describes the view and costs a skimmer
                    nothing, while this describes what happens to the file after
                    it leaves the app, where we can no longer protect it. So it
                    keeps the warning pair and its position beside the button —
                    and it disappears when the file is protected, because then it
                    is not true. Amber that can be absent is the same property
                    the yellow thread has, and the reason it still means
                    something when present. */}
                {!protectBackup && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 mb-4 flex items-start gap-3">
                    <AlertTriangleIcon className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" size={18} />
                    <p className="text-body text-amber-900 dark:text-amber-200">
                      This file is plain, readable JSON and it is <strong>not encrypted</strong>. Anyone who
                      opens it can see every account name, balance and transaction you have. Keep it
                      somewhere you would be willing to keep a bank statement — not a shared drive, not a
                      Downloads folder you never empty.
                    </p>
                  </div>
                )}

                <div className="mb-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={protectBackup}
                      onChange={(e) => {
                        setProtectBackup(e.target.checked);
                        // Not left lying in state once the choice is reversed.
                        if (!e.target.checked) {
                          setBackupPassword('');
                          setBackupPasswordConfirm('');
                        }
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                    />
                    <span>
                      <span className="block text-body font-medium text-gray-900 dark:text-white">
                        Protect this backup with a password
                      </span>
                      <span className="block text-body text-gray-500 dark:text-gray-400">
                        Encrypts the file so its contents cannot be read without the password.
                        You will be asked for it when restoring.
                      </span>
                    </span>
                  </label>

                  {protectBackup && (
                    <div className="mt-3 pl-7 space-y-3">
                      <div>
                        <label htmlFor="backup-password" className="block text-body font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Password
                        </label>
                        <input
                          id="backup-password"
                          type="password"
                          autoComplete="new-password"
                          value={backupPassword}
                          onChange={(e) => setBackupPassword(e.target.value)}
                          className="w-full max-w-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label htmlFor="backup-password-confirm" className="block text-body font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Password again
                        </label>
                        <input
                          id="backup-password-confirm"
                          type="password"
                          autoComplete="new-password"
                          value={backupPasswordConfirm}
                          onChange={(e) => setBackupPasswordConfirm(e.target.value)}
                          className="w-full max-w-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>

                      {/* The consequence first, then the remedy — and the
                          consequence here is total. Nobody can open this file
                          without the password: not another device, not a
                          support request, not us. That is the point of it, and
                          it is the one thing someone ticking this box may not
                          have thought through. */}
                      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 flex items-start gap-3">
                        <AlertTriangleIcon className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" size={18} />
                        <p className="text-body text-amber-900 dark:text-amber-200">
                          <strong>If you lose this password the backup cannot be opened</strong> — not by
                          another device, not by us. There is no reset. Write it down somewhere separate
                          from the file, or keep it in a password manager.
                        </p>
                      </div>

                      {backupPasswordProblem && (
                        <p className="text-body text-gray-600 dark:text-gray-400" aria-live="polite">
                          {backupPasswordProblem}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => { void handleExportEverything(); }}
                  disabled={isBackingUp || backupPasswordProblem !== null}
                  className="flex items-center gap-2 px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBackingUp ? <RefreshCwIcon size={16} className="animate-spin" /> : <DownloadIcon size={16} />}
                  {isProtecting
                    ? 'Protecting the file…'
                    : isBackingUp
                    ? 'Reading your data…'
                    : protectBackup
                    ? 'Download protected backup (JSON)'
                    : 'Download full backup (JSON)'}
                </button>

                {/* A real dataset is 50k+ transactions and 50+ round trips, so
                    the button reports what it is on rather than sitting silent
                    long enough to look broken. */}
                {backupProgress && (
                  <p className="text-body text-gray-600 dark:text-gray-400 mt-3" aria-live="polite">
                    {backupProgress.entity.replace(/_/g, ' ')} ({backupProgress.entityNumber} of{' '}
                    {backupProgress.entityCount}) — {backupProgress.rows.toLocaleString()} rows
                  </p>
                )}

                {backupError && (
                  <p className="text-body text-red-600 dark:text-red-400 mt-3">
                    The backup stopped and no file was written: {backupError}
                  </p>
                )}
              </div>
            </div>

            {/* Preview — a description of the FILE, not of the dataset. Every
                figure here comes from the same selection the export writes. */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 self-start">
              <h3 className="text-card font-semibold text-gray-900 dark:text-white mb-4">Preview</h3>
              <div className="space-y-3 text-body">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600 dark:text-gray-400">Period:</span>
                  <span className="text-gray-900 dark:text-white text-right">{rangeDescription}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600 dark:text-gray-400">Format:</span>
                  <span className="text-gray-900 dark:text-white uppercase">{format}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600 dark:text-gray-400">Transactions:</span>
                  <span className="text-gray-900 dark:text-white" data-testid="preview-transaction-count">
                    {transactionCount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600 dark:text-gray-400">Accounts:</span>
                  <span className="text-gray-900 dark:text-white" data-testid="preview-account-count">
                    {accountCount.toLocaleString()}
                  </span>
                </div>
              </div>

              {!hasSomethingToExport && (
                <p className="text-body text-amber-700 dark:text-amber-300 mt-4">
                  Nothing falls in this period with these options, so there is no file to write.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-card font-semibold text-gray-900 dark:text-white">Export Templates</h3>
                <button
                  onClick={() => setActiveTab('export')}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
                >
                  <PlusIcon size={16} />
                  Create Template
                </button>
              </div>
            </div>

            <div className="p-6">
              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <FileTextIcon size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 dark:text-gray-400">No templates</p>
                  <p className="text-body text-gray-400 dark:text-gray-500 mt-2">
                    Set up an export the way you like it, then use Save as Template on the Quick Export tab.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template) => (
                    <div key={template.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {template.name}
                          {/* A label, not a lock: these came with the app, and
                              they delete like any other. */}
                          {template.isStarter && (
                            <span className="ml-2 text-dense bg-[#f1f3f7] text-[#475569] dark:bg-gray-700 dark:text-gray-200 px-2 py-1 rounded">
                              Starter
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUseTemplate(template)}
                            /* Routine ink. Red stays on the destructive twin
                               beside it — that is the one colour is for. */
                            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            title={`Use template ${template.name}`}
                            aria-label={`Use template ${template.name}`}
                          >
                            <PlayIcon size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="p-1 text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                            title={`Delete template ${template.name}`}
                            aria-label={`Delete template ${template.name}`}
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-body text-gray-600 dark:text-gray-400 mb-3">
                        {template.description}
                      </p>
                      <div className="text-dense text-gray-500 dark:text-gray-400 space-y-1">
                        <div>Format: {template.options.format.toUpperCase()}</div>
                        {/* The period is stored as a RULE, so it says what it
                            will do next time — not what it did in the month it
                            was saved. */}
                        <div>Period: {describeTemplateRange(template.options)}</div>
                        <div>
                          Includes: {[
                            template.options.includeTransactions && 'Transactions',
                            template.options.includeAccounts && 'Accounts'
                          ].filter(Boolean).join(', ') || 'nothing yet'}
                        </div>
                        <div>Created: {formatDate(template.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dedicated Excel exporter (rich formatting, multiple entity sheets).
          Mounted only while open so its XLSX chunk stays deferred until used —
          and reached through `@spreadsheet`, so the edition that offers no
          button also builds no chunk to defer. */}
      {showExcelExport && (
        <Suspense fallback={<LoadingState />}>
          <SpreadsheetExport
            isOpen={showExcelExport}
            onClose={() => setShowExcelExport(false)}
          />
        </Suspense>
      )}

      <PageTip id="export-intro-2" title="Export your data" description="Download the transactions and accounts in the period you choose — as a PDF, a spreadsheet, or a QIF/OFX file another finance app can read. The full backup below is the only one you can restore." />
    </PageWrapper>
  );
}
