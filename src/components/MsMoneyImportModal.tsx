/**
 * Microsoft Money import — the user-facing destructive "total migration" flow.
 *
 *   pick .mny → decrypt + transform in-browser → PREVIEW exactly what will
 *   import → download a safety backup + type DELETE → run (with progress).
 *
 * Parsing is entirely client-side (see mnyReader). The destructive execution is
 * handed to `onExecute`, which the page wires to the local or cloud path.
 */
import { useCallback, useRef, useState } from 'react';
import { XCircleIcon, UploadIcon, AlertCircleIcon, CheckCircleIcon, DownloadIcon, DatabaseIcon } from './icons';
import { readMnyExport, MnyReadError } from '../services/import/msMoney/mnyReader';
import { MnyDecryptError } from '../services/import/msMoney/mnyDecrypt';
import { transformMsMoneyExport, type MsMoneyImportResult } from '../services/import/msMoney/transform';
import type { ImportProgress } from '../services/import/msMoney/msMoneyImport';
import { createScopedLogger } from '../loggers/scopedLogger';

const logger = createScopedLogger('MsMoneyImport');
const CONFIRM_WORD = 'DELETE';

type Stage = 'pick' | 'reading' | 'preview' | 'importing' | 'done' | 'error';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Download a JSON backup of the CURRENT data before wiping. */
  onBackup: () => void;
  /** Run the destructive import; resolves when the data is in place. */
  onExecute: (result: MsMoneyImportResult, onProgress: (p: ImportProgress) => void) => Promise<void>;
  /** Called after a successful import so the page can reload app data. */
  onImported: () => void;
}

export default function MsMoneyImportModal({ isOpen, onClose, onBackup, onExecute, onImported }: Props) {
  const [stage, setStage] = useState<Stage>('pick');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<MsMoneyImportResult | null>(null);
  const [error, setError] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [backedUp, setBackedUp] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStage('pick'); setFileName(''); setResult(null); setError('');
    setConfirmText(''); setBackedUp(false); setProgress(null);
  }, []);

  const handleClose = useCallback(() => {
    if (stage === 'importing') return; // never interrupt a destructive write
    reset();
    onClose();
  }, [stage, reset, onClose]);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setStage('reading');
    setError('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const exported = readMnyExport(bytes);
      const transformed = transformMsMoneyExport(exported, new Date().toISOString());
      setResult(transformed);
      setStage('preview');
    } catch (err) {
      logger.error('Failed to read .mny file', err);
      const msg = err instanceof MnyDecryptError || err instanceof MnyReadError
        ? err.message
        : 'Could not read this file. Please choose a valid Microsoft Money (.mny) file.';
      setError(msg);
      setStage('error');
    }
  }, []);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  const handleBackup = useCallback(() => {
    onBackup();
    setBackedUp(true);
  }, [onBackup]);

  const runImport = useCallback(async () => {
    if (!result) return;
    setStage('importing');
    setProgress({ phase: 'wiping', fraction: 0, message: 'Starting…' });
    try {
      await onExecute(result, setProgress);
      setStage('done');
      onImported();
    } catch (err) {
      logger.error('MS Money import failed', err);
      setError(err instanceof Error ? err.message : 'The import failed. Your backup file is safe.');
      setStage('error');
    }
  }, [result, onExecute, onImported]);

  if (!isOpen) return null;

  const s = result?.summary;
  const confirmReady = confirmText.trim().toUpperCase() === CONFIRM_WORD && backedUp;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <DatabaseIcon size={22} className="text-[#1a2332] dark:text-blue-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Import from Microsoft Money</h2>
          </div>
          <button onClick={handleClose} disabled={stage === 'importing'}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-40"
            aria-label="Close">
            <XCircleIcon size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* ── Pick ─────────────────────────────────────────────── */}
          {stage === 'pick' && (
            <div className="text-center py-6">
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Import your complete Microsoft Money history — every account, transaction,
                category and transfer. Your <code>.mny</code> file is read entirely in your
                browser; nothing is uploaded until you confirm.
              </p>
              <input ref={inputRef} type="file" accept=".mny" onChange={onInputChange} className="hidden" />
              <button onClick={() => inputRef.current?.click()}
                className="px-5 py-3 bg-[#1a2332] dark:bg-blue-600 text-white rounded-lg hover:bg-[#2d3a4d] dark:hover:bg-blue-700 transition-colors inline-flex items-center gap-2 font-medium">
                <UploadIcon size={20} />
                Choose Microsoft Money file
              </button>
            </div>
          )}

          {/* ── Reading ──────────────────────────────────────────── */}
          {stage === 'reading' && (
            <div className="text-center py-10">
              <div className="inline-block h-8 w-8 border-2 border-[#1a2332] dark:border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Reading {fileName}…</p>
            </div>
          )}

          {/* ── Preview + gate ───────────────────────────────────── */}
          {stage === 'preview' && s && (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Read <span className="font-medium text-gray-700 dark:text-gray-300">{fileName}</span> — here's what will be imported:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Stat label="Accounts" value={`${s.accounts.total}`} sub={`${s.accounts.open} open · ${s.accounts.closed} closed`} />
                  <Stat label="Transactions" value={s.transactions.imported.toLocaleString()} sub={`${s.transactions.transfers.toLocaleString()} transfers`} />
                  <Stat label="Categories" value={`${s.categories.subs + s.categories.details}`} sub={`${s.categories.subs} groups`} />
                  <Stat label="Split transactions" value={`${s.transactions.splitTransactions}`} sub={`${s.transactions.splitLines} lines`} />
                  <Stat label="Standalone" value={s.transactions.standalone.toLocaleString()} />
                </div>
              </div>

              {s.simplifications.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-600 dark:text-gray-400 font-medium">
                    {s.simplifications.length} note{s.simplifications.length > 1 ? 's' : ''} about how a few edge cases were handled
                  </summary>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-gray-500 dark:text-gray-400">
                    {s.simplifications.map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                </details>
              )}

              {/* Danger gate */}
              <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircleIcon size={20} className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-800 dark:text-red-200">
                    This is a <strong>total migration</strong>. It will <strong>permanently delete all of your current
                    data</strong> (accounts, transactions, budgets, goals) and replace it with the Microsoft Money import.
                    This cannot be undone.
                  </p>
                </div>
                <button onClick={handleBackup}
                  className={`w-full px-4 py-2 rounded-lg border text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors ${
                    backedUp
                      ? 'border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800'
                  }`}>
                  {backedUp ? <><CheckCircleIcon size={16} /> Backup downloaded</> : <><DownloadIcon size={16} /> Download a backup of my current data first</>}
                </button>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    Type <span className="font-mono font-bold">{CONFIRM_WORD}</span> to confirm
                  </label>
                  <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
                    placeholder={CONFIRM_WORD}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500" />
                  {!backedUp && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Download a backup to enable the import.</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancel
                </button>
                <button onClick={runImport} disabled={!confirmReady}
                  className="flex-1 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed font-medium">
                  Delete everything &amp; import
                </button>
              </div>
            </div>
          )}

          {/* ── Importing ────────────────────────────────────────── */}
          {stage === 'importing' && progress && (
            <div className="py-8">
              <p className="text-center text-gray-700 dark:text-gray-300 mb-4">{progress.message}</p>
              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div className="h-full bg-[#1a2332] dark:bg-blue-600 transition-[width] duration-300"
                  style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
              </div>
              <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-3">
                Please keep this window open until the import finishes.
              </p>
            </div>
          )}

          {/* ── Done ─────────────────────────────────────────────── */}
          {stage === 'done' && s && (
            <div className="text-center py-8">
              <CheckCircleIcon size={40} className="text-green-600 dark:text-green-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Import complete</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {s.accounts.total} accounts and {s.transactions.imported.toLocaleString()} transactions are now in WealthTracker.
              </p>
              <button onClick={handleClose}
                className="px-5 py-2 bg-[#1a2332] dark:bg-blue-600 text-white rounded-lg hover:bg-[#2d3a4d] dark:hover:bg-blue-700 font-medium">
                Done
              </button>
            </div>
          )}

          {/* ── Error ────────────────────────────────────────────── */}
          {stage === 'error' && (
            <div className="text-center py-8">
              <AlertCircleIcon size={40} className="text-red-600 dark:text-red-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Something went wrong</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">{error}</p>
              <div className="flex gap-3 justify-center">
                <button onClick={handleClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  Close
                </button>
                <button onClick={reset}
                  className="px-4 py-2 bg-[#1a2332] dark:bg-blue-600 text-white rounded-lg hover:bg-[#2d3a4d] dark:hover:bg-blue-700">
                  Try another file
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
      <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">{label}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
