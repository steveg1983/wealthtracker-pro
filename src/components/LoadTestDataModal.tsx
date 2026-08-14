import React, { useCallback, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useApp } from '../contexts/AppContextSupabase';
import { createScopedLogger } from '../loggers/scopedLogger';
import { AlertCircleIcon, CheckCircleIcon, DatabaseIcon } from './icons';
import { TEST_DATA_COUNTS, type TestDataProgress, type TestDataSeedResult } from '../utils/testDataset';

/**
 * Load the sample dataset into this login.
 *
 * This dialog used to promise "5 sample accounts, Multiple transactions,
 * Example budgets" in front of a function that logged a line and returned. Two
 * things follow from that, and they shape the whole file. The numbers are read
 * from the dataset itself rather than typed into the copy, so they cannot drift
 * away from what the seed actually creates. And the seed is watched to the end:
 * a run reports what it is doing while it does it, and finishes on either a
 * count of what was written or the reason it stopped. It never just closes.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Phase = 'confirm' | 'loading' | 'done' | 'failed';

const testDataLogger = createScopedLogger('LoadTestDataModal');

/** "1 account" / "4 accounts" — a count that reads like English. */
const plural = (count: number, singular: string, pluralForm = `${singular}s`): string =>
  `${count.toLocaleString()} ${count === 1 ? singular : pluralForm}`;

/** Join a list the way a sentence does: "a, b and c". */
const sentenceList = (parts: string[]): string =>
  parts.length <= 1
    ? parts.join('')
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

export default function LoadTestDataModal({ isOpen, onClose }: Props): React.JSX.Element {
  const { loadTestData } = useApp();

  const [phase, setPhase] = useState<Phase>('confirm');
  const [progress, setProgress] = useState<TestDataProgress | null>(null);
  const [result, setResult] = useState<TestDataSeedResult | null>(null);
  const [failure, setFailure] = useState<{ message: string; partial: TestDataProgress | null } | null>(null);

  const handleClose = useCallback(() => {
    // A seed in flight must not be abandoned by a stray click: the writes would
    // keep landing with nothing on screen reporting them.
    if (phase === 'loading') return;
    setPhase('confirm');
    setProgress(null);
    setResult(null);
    setFailure(null);
    onClose();
  }, [phase, onClose]);

  const handleLoad = useCallback(async () => {
    setPhase('loading');
    setProgress({ phase: 'categories', fraction: 0, message: 'Starting…' });
    setFailure(null);
    let lastProgress: TestDataProgress | null = null;
    try {
      const seeded = await loadTestData((update) => {
        lastProgress = update;
        setProgress(update);
      });
      setResult(seeded);
      setPhase('done');
    } catch (error) {
      testDataLogger.error('Loading test data failed', error);
      setFailure({
        message: error instanceof Error ? error.message : String(error),
        partial: lastProgress
      });
      setPhase('failed');
    }
  }, [loadTestData]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Load test data"
      size="md"
      closeOnBackdrop={phase !== 'loading'}
      showCloseButton={phase !== 'loading'}
    >
      <ModalBody>
        {phase === 'confirm' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="shrink-0 grid place-items-center h-9 w-9 rounded-lg bg-gray-100 dark:bg-gray-700 text-[#1a2332] dark:text-blue-400">
                <DatabaseIcon size={18} />
              </span>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sample accounts and spending, so you can try the app on data that
                isn't yours. This creates:
              </p>
            </div>
            <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li>{plural(TEST_DATA_COUNTS.accounts, 'account')} — a current account, savings, an investment portfolio and a credit card</li>
              <li>{plural(TEST_DATA_COUNTS.transactions, 'transaction')} across those accounts, over the last 90 days</li>
              <li>{plural(TEST_DATA_COUNTS.budgets, 'monthly budget')}</li>
              <li>Any categories the sample uses that you don't already have — matched by name, so nothing of yours is renamed or replaced</li>
            </ul>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Each account opens at a balance that its transactions add up to, so
              the figures agree with the register.
            </p>
            <p className="text-sm text-orange-600 dark:text-orange-400">
              This is added alongside what you already have. Nothing existing is
              changed or removed — and nothing removes it afterwards either, so
              on a login with real data in it you would be mixing the two.
            </p>
          </div>
        )}

        {phase === 'loading' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {progress?.message ?? 'Working…'}
            </p>
            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full bg-[#1a2332] dark:bg-blue-600 transition-all duration-200"
                style={{ width: `${Math.round((progress?.fraction ?? 0) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Rows are written one at a time so each balance lands correctly.
              Leave this open until it finishes.
            </p>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="text-green-600 dark:text-green-400 mt-0.5 shrink-0" size={20} />
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Created {sentenceList([
                  plural(result.accounts, 'account'),
                  plural(result.transactions, 'transaction'),
                  plural(result.budgets, 'budget')
                ])}.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {result.categoriesCreated === 0
                  ? 'Every category the sample needed was already in your login.'
                  : `${plural(result.categoriesCreated, 'category', 'categories')} added, because your login didn't have them.`}
              </p>
            </div>
          </div>
        )}

        {phase === 'failed' && failure && (
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" size={20} />
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                The sample data was not fully created.
              </p>
              {/* Said plainly rather than smoothed over: the writes are separate,
                  so a failure part-way leaves the rows written before it in
                  place. The user needs to know they are there. */}
              <p className="text-sm text-gray-600 dark:text-gray-400">
                It stopped {failure.partial ? `while ${failure.partial.message.replace(/…$/, '').toLowerCase()}` : 'before it began'}, and
                anything written before that point is still in your login.
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 break-words">{failure.message}</p>
            </div>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <div className="flex gap-3 w-full">
          <button
            onClick={handleClose}
            disabled={phase === 'loading'}
            className="flex-1 justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
          >
            {phase === 'done' ? 'Close' : 'Cancel'}
          </button>
          {phase !== 'done' && (
            <button
              onClick={() => { void handleLoad(); }}
              disabled={phase === 'loading'}
              className="flex-1 justify-center px-4 py-2 bg-[#1a2332] dark:bg-blue-600 text-white rounded-lg hover:bg-[#243044] dark:hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {phase === 'loading' ? 'Loading…' : phase === 'failed' ? 'Try again' : 'Load test data'}
            </button>
          )}
        </div>
      </ModalFooter>
    </Modal>
  );
}
