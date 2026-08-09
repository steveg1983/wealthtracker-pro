/**
 * Batch Import is a QUEUE. These tests exist to keep it one.
 *
 * The screen it replaced parsed files itself, guessed destination accounts and
 * wrote rows through a path the single-file dialogs had already been fixed to
 * stop using — then reported counts it read from a stale render snapshot, so it
 * always said "0 of N" no matter what it had done. So what is checked here is
 * not "does it import": it is that this component hands each file to the real
 * dialog, never claims an outcome of its own, and never quietly loses a file.
 *
 * The three importers are stubbed BECAUSE the point is the routing. What they do
 * with a file is their own tests' subject, and is not repeated here.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BatchImportModal from './BatchImportModal';

interface StubModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFile?: File;
}

const csvOpened = vi.fn<(name: string | undefined) => void>();
const ofxOpened = vi.fn<(name: string | undefined) => void>();
const qifOpened = vi.fn<(name: string | undefined) => void>();

const stub = (label: string, record: (name: string | undefined) => void) =>
  function StubImporter({ isOpen, onClose, initialFile }: StubModalProps): React.JSX.Element | null {
    React.useEffect(() => {
      if (isOpen) record(initialFile?.name);
    }, [isOpen, initialFile]);
    if (!isOpen) return null;
    return (
      <div>
        <p>{label} open for {initialFile?.name ?? 'no file'}</p>
        <button onClick={onClose}>Close {label}</button>
      </div>
    );
  };

vi.mock('./CSVImportWizard', () => ({ default: stub('CSV wizard', (name) => csvOpened(name)) }));
vi.mock('./OFXImportModal', () => ({ default: stub('OFX importer', (name) => ofxOpened(name)) }));
vi.mock('./QIFImportModal', () => ({ default: stub('QIF importer', (name) => qifOpened(name)) }));

const defaultProps = { isOpen: true, onClose: vi.fn() };

/** Synthetic files — nothing here reads a byte of them. */
const makeFile = (name: string): File => new File(['synthetic'], name, { type: 'text/plain' });

const selectFiles = (files: File[]): void => {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('no file input rendered');
  fireEvent.change(input, { target: { files } });
};

describe('BatchImportModal (a queue over the real importers)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('the file list', () => {
    it('names the importer each file will open in', () => {
      render(<BatchImportModal {...defaultProps} />);
      selectFiles([makeFile('january.ofx'), makeFile('ledger.csv'), makeFile('quicken.qif')]);

      expect(screen.getByText('january.ofx')).toBeInTheDocument();
      expect(screen.getByText(/Opens in the OFX importer/)).toBeInTheDocument();
      expect(screen.getByText(/Opens in the CSV importer/)).toBeInTheDocument();
      expect(screen.getByText(/Opens in the QIF importer/)).toBeInTheDocument();
    });

    /**
     * The old screen alerted once and then filtered these out of its own list,
     * so a statement in the wrong format looked accepted and was never mentioned
     * again. A file nobody is told about is a file somebody believes is imported.
     */
    it('keeps a file it cannot read, and says so', () => {
      render(<BatchImportModal {...defaultProps} />);
      selectFiles([makeFile('statement.pdf'), makeFile('january.ofx')]);

      expect(screen.getByText('statement.pdf')).toBeInTheDocument();
      expect(screen.getByText(/Not importable/)).toBeInTheDocument();
      expect(screen.getByText('2 files')).toBeInTheDocument();
    });

    it('will not start when nothing in the list can be imported', () => {
      render(<BatchImportModal {...defaultProps} />);
      selectFiles([makeFile('statement.pdf')]);

      expect(screen.getByRole('button', { name: /^Start/ })).toBeDisabled();
      expect(screen.getByText(/None of these files can be imported here/)).toBeInTheDocument();
    });

    it('counts only the importable files on the Start button', () => {
      render(<BatchImportModal {...defaultProps} />);
      selectFiles([makeFile('statement.pdf'), makeFile('a.ofx'), makeFile('b.qif')]);

      expect(screen.getByRole('button', { name: /Start — 2 files/ })).toBeEnabled();
    });

    it('lets a file be taken back off the list', () => {
      render(<BatchImportModal {...defaultProps} />);
      selectFiles([makeFile('a.ofx'), makeFile('b.qif')]);

      fireEvent.click(screen.getByRole('button', { name: 'Remove a.ofx' }));

      expect(screen.queryByText('a.ofx')).not.toBeInTheDocument();
      expect(screen.getByText('b.qif')).toBeInTheDocument();
    });
  });

  describe('running the queue', () => {
    it('opens each file in its own importer, in list order, and hands over the file itself', async () => {
      render(<BatchImportModal {...defaultProps} />);
      selectFiles([makeFile('january.ofx'), makeFile('ledger.csv'), makeFile('quicken.qif')]);
      fireEvent.click(screen.getByRole('button', { name: /^Start/ }));

      await waitFor(() => {
        expect(screen.getByText('OFX importer open for january.ofx')).toBeInTheDocument();
      });
      expect(ofxOpened).toHaveBeenCalledWith('january.ofx');
      // One dialog at a time: the queue's own screen is gone while this is up.
      expect(screen.queryByRole('button', { name: /^Start/ })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Close OFX importer' }));
      await waitFor(() => {
        expect(screen.getByText('CSV wizard open for ledger.csv')).toBeInTheDocument();
      });
      expect(csvOpened).toHaveBeenCalledWith('ledger.csv');

      fireEvent.click(screen.getByRole('button', { name: 'Close CSV wizard' }));
      await waitFor(() => {
        expect(screen.getByText('QIF importer open for quicken.qif')).toBeInTheDocument();
      });
      expect(qifOpened).toHaveBeenCalledWith('quicken.qif');
    });

    it('steps over a file it cannot read instead of stopping on it', async () => {
      render(<BatchImportModal {...defaultProps} />);
      selectFiles([makeFile('january.ofx'), makeFile('statement.pdf'), makeFile('quicken.qif')]);
      fireEvent.click(screen.getByRole('button', { name: /^Start/ }));

      await waitFor(() => {
        expect(screen.getByText('OFX importer open for january.ofx')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Close OFX importer' }));

      await waitFor(() => {
        expect(screen.getByText('QIF importer open for quicken.qif')).toBeInTheDocument();
      });
    });

    it('gives a second file of the same kind a fresh dialog', async () => {
      render(<BatchImportModal {...defaultProps} />);
      selectFiles([makeFile('january.ofx'), makeFile('february.ofx')]);
      fireEvent.click(screen.getByRole('button', { name: /^Start/ }));

      await waitFor(() => {
        expect(screen.getByText('OFX importer open for january.ofx')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Close OFX importer' }));

      await waitFor(() => {
        expect(screen.getByText('OFX importer open for february.ofx')).toBeInTheDocument();
      });
      // Mounted twice, not re-rendered once: the second file must not inherit
      // the first one's parse, chosen account or result screen.
      expect(ofxOpened).toHaveBeenCalledTimes(2);
    });
  });

  describe('the summary', () => {
    const runToEnd = async (): Promise<void> => {
      render(<BatchImportModal {...defaultProps} />);
      selectFiles([makeFile('january.ofx'), makeFile('statement.pdf')]);
      fireEvent.click(screen.getByRole('button', { name: /^Start/ }));

      await waitFor(() => {
        expect(screen.getByText('OFX importer open for january.ofx')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Close OFX importer' }));
      await waitFor(() => {
        expect(screen.getByText(/Handled in the OFX importer/)).toBeInTheDocument();
      });
    };

    it('reports each file as handled by its own dialog', async () => {
      await runToEnd();

      expect(screen.getByText('january.ofx')).toBeInTheDocument();
      expect(screen.getByText(/Handled in the OFX importer/)).toBeInTheDocument();
    });

    it('says out loud that the file it could not read reached no account', async () => {
      await runToEnd();

      expect(screen.getByText(/Left out — nothing here can read this file/)).toBeInTheDocument();
      expect(screen.getByText(/never opened, so nothing in it reached any account/)).toBeInTheDocument();
    });

    /**
     * The whole reason this screen was rebuilt. It cannot know what any importer
     * wrote — each one reported that from its own write, on its own result
     * screen — so it must not offer a rival figure. The predecessor did, and the
     * figure it offered was always zero.
     */
    it('invents no counters of its own', async () => {
      await runToEnd();

      expect(screen.queryByText(/transactions imported/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/duplicates skipped/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/success rate/i)).not.toBeInTheDocument();
      expect(screen.getByText(/each importer showed you what it wrote/i)).toBeInTheDocument();
    });
  });
});
