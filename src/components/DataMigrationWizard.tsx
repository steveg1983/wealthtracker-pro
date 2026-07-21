/**
 * Data Migration Wizard — an HONEST router to the app's real importers.
 *
 * The previous version pantomimed a five-step migration: a setTimeout for
 * "processing", hard-coded preview numbers (every user saw "1,234
 * transactions"), and a "complete" step that imported nothing. That is the
 * worst kind of broken — it lies.
 *
 * What actually exists and works: the CSV import wizard, the QIF importer, the
 * OFX importer, and the dedicated Microsoft Money total migration. So this
 * wizard now does the one thing the old version did well — per-app export
 * instructions — and then opens the RIGHT real tool, wired via onOpenTool.
 */
import React, { useState } from 'react';
import { FileTextIcon, DatabaseIcon, ArrowLeftIcon, CreditCardIcon, TrendingUpIcon, UsersIcon, ShieldIcon, XIcon, AlertCircleIcon } from './icons';
import type { IconProps } from './icons';

/** The real import tools this wizard can hand off to. */
export type MigrationTool = 'csv' | 'qif' | 'ofx' | 'msmoney';

interface ToolOption {
  tool: MigrationTool;
  label: string;
  hint: string;
}

interface MigrationSource {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<IconProps>;
  /** How to get your data out of the source app. */
  instructions: string[];
  tools: ToolOption[];
  /** Money is a destructive total migration — surfaced differently. */
  destructiveNote?: string;
}

const SOURCES: MigrationSource[] = [
  {
    id: 'msmoney',
    name: 'Microsoft Money',
    description: 'Native .mny file — full migration',
    icon: DatabaseIcon,
    instructions: [
      'Locate your Money file (usually My Documents, ending in .mny).',
      'No export needed — WealthTracker reads the file directly in your browser.',
    ],
    tools: [{ tool: 'msmoney', label: 'Open the Microsoft Money importer', hint: 'Reads the .mny natively' }],
    destructiveNote:
      'The Microsoft Money importer is a TOTAL migration: it replaces all current data with the contents of your Money file.',
  },
  {
    id: 'mint',
    name: 'Mint',
    description: 'Intuit Mint CSV export',
    icon: CreditCardIcon,
    instructions: [
      'In Mint, go to Transactions and use “Export all transactions” (CSV).',
      'Save the CSV file somewhere you can find it.',
    ],
    tools: [{ tool: 'csv', label: 'Open the CSV importer', hint: 'Maps Mint’s CSV columns' }],
  },
  {
    id: 'quicken',
    name: 'Quicken',
    description: 'QIF or QFX export',
    icon: TrendingUpIcon,
    instructions: [
      'In Quicken: File → Export → QIF for full history, or download QFX from your bank inside Quicken.',
      'QIF preserves the most detail; QFX (Web Connect) files use the OFX importer.',
    ],
    tools: [
      { tool: 'qif', label: 'Open the QIF importer', hint: 'Best for full Quicken history' },
      { tool: 'ofx', label: 'Open the OFX importer', hint: 'For QFX / Web Connect files' },
    ],
  },
  {
    id: 'ynab',
    name: 'YNAB',
    description: 'You Need A Budget CSV',
    icon: UsersIcon,
    instructions: [
      'In YNAB: My Budget → Export budget data — you’ll get a ZIP containing CSV files.',
      'Unzip it and use the “Register” CSV (your transactions).',
    ],
    tools: [{ tool: 'csv', label: 'Open the CSV importer', hint: 'Use the Register CSV' }],
  },
  {
    id: 'personalcapital',
    name: 'Personal Capital',
    description: 'Empower / Personal Capital CSV',
    icon: ShieldIcon,
    instructions: [
      'In Personal Capital (Empower): Transactions → download as CSV.',
    ],
    tools: [{ tool: 'csv', label: 'Open the CSV importer', hint: 'Maps the transaction CSV' }],
  },
  {
    id: 'spreadsheet',
    name: 'Excel / other CSV',
    description: 'Any spreadsheet or CSV',
    icon: FileTextIcon,
    instructions: [
      'In Excel (or any spreadsheet): File → Save As → CSV.',
      'Make sure there’s a header row (date, description, amount at minimum).',
    ],
    tools: [{ tool: 'csv', label: 'Open the CSV importer', hint: 'Column mapping included' }],
  },
];

interface DataMigrationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /** Open one of the real import tools (the page owns those modals). */
  onOpenTool: (tool: MigrationTool) => void;
}

export default function DataMigrationWizard({ isOpen, onClose, onOpenTool }: DataMigrationWizardProps): React.JSX.Element | null {
  const [source, setSource] = useState<MigrationSource | null>(null);

  if (!isOpen) return null;

  const handleClose = () => { setSource(null); onClose(); };
  const openTool = (tool: MigrationTool) => {
    setSource(null);
    onOpenTool(tool);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {source && (
              <button onClick={() => setSource(null)} aria-label="Back to app list"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <ArrowLeftIcon size={20} />
              </button>
            )}
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {source ? `Migrate from ${source.name}` : 'Where are you migrating from?'}
            </h2>
          </div>
          <button onClick={handleClose} aria-label="Close migration wizard"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <XIcon size={22} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {!source && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SOURCES.map(s => (
                <button key={s.id} onClick={() => setSource(s)}
                  className="text-left rounded-xl border border-gray-200 dark:border-gray-700 hover:border-[#1a2332]/30 dark:hover:border-blue-500/40 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors p-3 flex items-center gap-3">
                  <span className="shrink-0 grid place-items-center h-9 w-9 rounded-lg bg-gray-100 dark:bg-gray-700 text-[#1a2332] dark:text-blue-400">
                    <s.icon size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">{s.name}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{s.description}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {source && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Get your data out of {source.name}</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  {source.instructions.map((line, i) => <li key={i}>{line}</li>)}
                </ol>
              </div>

              {source.destructiveNote && (
                <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 flex items-start gap-2">
                  <AlertCircleIcon size={18} className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-800 dark:text-red-200">{source.destructiveNote}</p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Then import it here</h3>
                <div className="space-y-2">
                  {source.tools.map(t => (
                    <button key={t.tool} onClick={() => openTool(t.tool)}
                      className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 hover:border-[#1a2332]/30 dark:hover:border-blue-500/40 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors p-3 flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900 dark:text-white">{t.label}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">{t.hint}</span>
                      </span>
                      <span className="text-gray-400 dark:text-gray-500 shrink-0">→</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
