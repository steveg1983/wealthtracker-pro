import React, { useCallback, useMemo, useState, Suspense } from 'react';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { LoadingState } from './loading/LoadingState';
import { lazyWithRecovery } from '../utils/lazyWithRecovery';
import {
  UploadIcon,
  FolderIcon,
  XIcon,
  CheckIcon,
  AlertCircleIcon,
  PlayIcon
} from './icons';

/**
 * Batch Import — a QUEUE, and nothing else.
 *
 * This screen used to be a fourth importer. It read the files itself, guessed a
 * destination account (CSV and QIF simply took accounts[0]), and wrote rows one
 * at a time through the context — bypassing the atomic, chunked, FITID-keyed
 * write path that the OFX, QIF and CSV dialogs had already been fixed to use.
 * Its counters read a stale render snapshot and so always said "0 of N", its
 * per-file errors were rendered in a branch the summary unmounted, and its CSV
 * path handed header-stripped rows to a preview that expected a header row, so
 * it imported nothing at all and reported that as success.
 *
 * None of that is rebuilt here. This component parses nothing, matches no
 * account, writes no row and counts no transaction. It holds a list of files and
 * opens the real dialog for each one in turn. Every guarantee a file gets —
 * account matching, the duplicate review, the all-or-nothing chunked write, the
 * honest per-file result screen — comes from the dialog that opens, which is the
 * same dialog the CSV / OFX / QIF tiles open for a single file.
 */

// Lazy for the same reason the import page's tiles are: a queue of three files
// should not make everyone who opens this dialog download three importers up
// front. Only the one for the file in hand is fetched, when it is reached.
const CSVImportWizard = lazyWithRecovery(() => import('./CSVImportWizard'));
const OFXImportModal = lazyWithRecovery(() => import('./OFXImportModal'));
const QIFImportModal = lazyWithRecovery(() => import('./QIFImportModal'));

/** The file kinds this app has a real importer for. */
type ImportableKind = 'csv' | 'ofx' | 'qif';

const IMPORTER_NAME: Record<ImportableKind, string> = {
  csv: 'CSV importer',
  ofx: 'OFX importer',
  qif: 'QIF importer'
};

interface QueuedFile {
  file: File;
  /** null when no importer here can read it — the row still gets shown. */
  kind: ImportableKind | null;
}

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** By extension only. Nothing here opens a file to find out what it is. */
function detectKind(filename: string): ImportableKind | null {
  const extension = filename.toLowerCase().split('.').pop();
  if (extension === 'csv' || extension === 'ofx' || extension === 'qif') return extension;
  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / 1048576)} MB`;
}

export default function BatchImportModal({ isOpen, onClose }: BatchImportModalProps): React.JSX.Element {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  /** Index into `queue` of the file whose real dialog is open; null when none is. */
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  /** True once the last importable file's dialog has been closed. */
  const [finished, setFinished] = useState(false);

  const importableIndexes = useMemo(
    () => queue.reduce<number[]>((found, entry, index) => {
      if (entry.kind !== null) found.push(index);
      return found;
    }, []),
    [queue]
  );

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    // Files this dialog cannot read are added too, greyed and labelled. The
    // previous version alerted once and then DROPPED them, so a statement in
    // the wrong format left the drop zone looking like it had been accepted.
    const additions = Array.from(incoming).map(file => ({ file, kind: detectKind(file.name) }));
    setQueue(previous => [...previous, ...additions]);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  }, [addFiles]);

  const handleSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(event.target.files);
    // Let the same file be chosen again after it has been removed from the list.
    event.target.value = '';
  }, [addFiles]);

  const removeAt = useCallback((index: number) => {
    setQueue(previous => previous.filter((_, i) => i !== index));
  }, []);

  const start = useCallback(() => {
    const first = importableIndexes[0];
    if (first === undefined) return;
    setFinished(false);
    setActiveIndex(first);
  }, [importableIndexes]);

  /**
   * The open dialog closed. Move to the next importable file, or finish.
   *
   * Deliberately says nothing about what that dialog did: it is the only thing
   * that knows, it has just told the user on its own result screen, and a
   * second opinion here could only be a guess dressed up as a count.
   */
  const advance = useCallback(() => {
    if (activeIndex === null) return;
    const next = importableIndexes.find(index => index > activeIndex);
    if (next === undefined) {
      setActiveIndex(null);
      setFinished(true);
      return;
    }
    setActiveIndex(next);
  }, [activeIndex, importableIndexes]);

  const reset = useCallback(() => {
    setQueue([]);
    setActiveIndex(null);
    setFinished(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const active = activeIndex === null ? null : queue[activeIndex] ?? null;

  return (
    <>
      {/* One dialog at a time. While a file's own importer is open this one is
          closed, so there is never a modal stacked on a modal and never two
          Escape targets. */}
      <Modal
        isOpen={isOpen && active === null}
        onClose={handleClose}
        title="Batch Import"
        size="xl"
      >
        <ModalBody>
          {finished ? (
            <BatchSummary queue={queue} />
          ) : (
            <>
              <div
                onDrop={handleDrop}
                onDragOver={(event) => event.preventDefault()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-primary transition-colors"
              >
                <FolderIcon size={40} className="mx-auto text-gray-400 mb-3" />
                <h3 className="text-lg font-semibold mb-1 text-gray-900 dark:text-white">
                  Drop your files here, or choose them
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  CSV, OFX and QIF files
                </p>
                {/* sr-only, NOT `hidden`: a display:none input is out of the tab
                    order, and a <label> cannot take focus in its place — so the
                    only way to reach the picker would be a mouse. Hidden this
                    way the input still takes focus, and focus-within paints the
                    ring on the button the user can actually see. */}
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary cursor-pointer focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
                  <UploadIcon size={20} />
                  {queue.length === 0 ? 'Select files' : 'Add more files'}
                  <input
                    type="file"
                    multiple
                    accept=".csv,.ofx,.qif"
                    onChange={handleSelect}
                    className="sr-only"
                  />
                </label>
              </div>

              {/* What pressing Start actually does, said before it happens. The
                  one-file-at-a-time dialogs are the point of this screen, not a
                  detail of it, so nobody should meet the first one by surprise. */}
              <div className="mt-6 flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
                <AlertCircleIcon size={18} className="mt-0.5 flex-shrink-0" />
                <p>
                  Each file opens in its own importer, one after another — the same
                  dialog the CSV, OFX and QIF buttons open. You choose the account
                  and confirm anything that looks like a transaction you already
                  have, then closing that dialog moves on to the next file.
                </p>
              </div>

              {queue.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                    {queue.length === 1 ? '1 file' : `${queue.length} files`}
                  </h3>
                  <ul className="space-y-2 max-h-80 overflow-y-auto">
                    {queue.map((entry, index) => (
                      <li
                        key={`${entry.file.name}-${index}`}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          entry.kind === null
                            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                            : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {entry.file.name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {formatFileSize(entry.file.size)}
                            {entry.kind === null ? (
                              // Named, not dropped: a file left out in silence is
                              // a statement someone believes is in the register.
                              <span className="ml-2 text-yellow-700 dark:text-yellow-400">
                                • Not importable — there is no importer here for this
                                kind of file, so it will be left out
                              </span>
                            ) : (
                              <span className="ml-2 text-gray-500 dark:text-gray-400">
                                • Opens in the {IMPORTER_NAME[entry.kind]}
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => removeAt(index)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          aria-label={`Remove ${entry.file.name}`}
                        >
                          <XIcon size={20} />
                        </button>
                      </li>
                    ))}
                  </ul>

                  {importableIndexes.length === 0 && (
                    <p className="mt-3 text-sm text-yellow-700 dark:text-yellow-400">
                      None of these files can be imported here. Add a CSV, OFX or
                      QIF file, or use the Microsoft Money importer for a
                      <code> .mny</code> file.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </ModalBody>

        <ModalFooter className="flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            {finished ? 'Done' : 'Cancel'}
          </button>
          {!finished && (
            <button
              onClick={start}
              disabled={importableIndexes.length === 0}
              className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary disabled:opacity-50 flex items-center gap-2"
            >
              <PlayIcon size={20} />
              {importableIndexes.length === 1
                ? 'Start — 1 file'
                : `Start — ${importableIndexes.length} files`}
            </button>
          )}
          {finished && (
            <button
              onClick={reset}
              className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary"
            >
              Import more files
            </button>
          )}
        </ModalFooter>
      </Modal>

      {/* The real dialog for the file in hand. Keyed by queue position so two
          consecutive files of the same kind get a FRESH dialog rather than one
          still holding the previous file's parse, account and result. */}
      {active !== null && active.kind !== null && (
        <Suspense fallback={<LoadingState />}>
          {active.kind === 'csv' && (
            <CSVImportWizard
              key={activeIndex}
              isOpen
              onClose={advance}
              type="transaction"
              initialFile={active.file}
            />
          )}
          {active.kind === 'ofx' && (
            <OFXImportModal
              key={activeIndex}
              isOpen
              onClose={advance}
              initialFile={active.file}
            />
          )}
          {active.kind === 'qif' && (
            <QIFImportModal
              key={activeIndex}
              isOpen
              onClose={advance}
              initialFile={active.file}
            />
          )}
        </Suspense>
      )}
    </>
  );
}

/**
 * What this run did, as far as THIS screen can honestly know.
 *
 * It can know which files it opened an importer for and which it never could.
 * It cannot know what any of them wrote: each importer reported that on its own
 * result screen, from its own write, and a number invented here would be a
 * second, quieter answer to a question that already has a real one. The old
 * version of this screen did exactly that and always answered "0".
 */
function BatchSummary({ queue }: { queue: QueuedFile[] }): React.JSX.Element {
  const opened = queue.filter(entry => entry.kind !== null);
  const skipped = queue.filter(entry => entry.kind === null);

  return (
    <div>
      <div className="text-center mb-6">
        <CheckIcon size={40} className="mx-auto text-blue-600 dark:text-blue-400 mb-3" />
        {/* Counts only the files that were opened, because that is the only
            number this screen is entitled to. The ones it could not read are
            named in the list below and again underneath it — never folded into
            a total that would imply they went somewhere. */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {opened.length === 1
            ? 'That file has been through its importer'
            : `Those ${opened.length} files have each been through their importer`}
        </h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
          Each one opened in its own importer, and each importer showed you what it
          wrote. Any you closed without importing wrote nothing — open that file on
          its own to try again.
        </p>
      </div>

      <ul className="space-y-2">
        {queue.map((entry, index) => (
          <li
            key={`${entry.file.name}-${index}`}
            className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
              entry.kind === null
                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
            }`}
          >
            <span className="flex-1 min-w-0 truncate font-medium text-gray-900 dark:text-white">
              {entry.file.name}
            </span>
            <span className={entry.kind === null
              ? 'text-yellow-700 dark:text-yellow-400'
              : 'text-gray-600 dark:text-gray-400'}
            >
              {entry.kind === null
                ? 'Left out — nothing here can read this file'
                : `Handled in the ${IMPORTER_NAME[entry.kind]}`}
            </span>
          </li>
        ))}
      </ul>

      {skipped.length > 0 && (
        <p className="mt-4 text-sm text-yellow-700 dark:text-yellow-400">
          {skipped.length === 1
            ? 'That one file was never opened, so nothing in it reached any account.'
            : `Those ${skipped.length} files were never opened, so nothing in them reached any account.`}
        </p>
      )}
    </div>
  );
}
