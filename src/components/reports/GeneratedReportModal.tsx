import React, { useEffect, memo } from 'react';
import { XIcon, CopyIcon, DownloadIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface GeneratedReportModalProps {
  report: {
    content: string;
    format: 'pdf' | 'csv' | 'summary';
    filename: string;
  };
  onClose: () => void;
  onCopy: () => void;
  onDownload: () => void;
}

export const GeneratedReportModal = memo(function GeneratedReportModal({ report,
  onClose,
  onCopy,
  onDownload
 }: GeneratedReportModalProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('GeneratedReportModal component initialized', {
      componentName: 'GeneratedReportModal'
    });
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Generated Report
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XIcon size={20} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-mono">
            {report.content}
          </pre>
        </div>
        
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
          <button
            onClick={onCopy}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <CopyIcon size={16} />
            Copy to Clipboard
          </button>
          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <DownloadIcon size={16} />
            Download
          </button>
        </div>
      </div>
    </div>
  );
});