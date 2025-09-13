import React, { useEffect, memo } from 'react';
import { DownloadIcon, PdfIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface ReportsHeaderProps {
  showExportButtons: boolean;
  isGeneratingPDF: boolean;
  onExportCSV: () => void;
  onExportPDF: () => void;
}

const ReportsHeader = memo(function ReportsHeader({
  showExportButtons,
  isGeneratingPDF,
  onExportCSV,
  onExportPDF
}: ReportsHeaderProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ReportsHeader component initialized', {
      componentName: 'ReportsHeader'
    });
  }, []);

  return (
    <div className="flex justify-between items-center mb-6">
      <div className="bg-secondary dark:bg-gray-700 rounded-2xl shadow p-4">
        <h1 className="text-3xl font-bold text-white">Reports</h1>
      </div>
      {showExportButtons && (
        <div className="flex gap-2">
          <button
            onClick={onExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-2xl hover:bg-secondary transition-colors"
          >
            <DownloadIcon size={20} />
            Export CSV
          </button>
          <button
            onClick={onExportPDF}
            disabled={isGeneratingPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PdfIcon size={20} />
            {isGeneratingPDF ? 'Generating...' : 'Export PDF'}
          </button>
        </div>
      )}
    </div>
  );
});

export default ReportsHeader;