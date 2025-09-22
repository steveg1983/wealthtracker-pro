import React from 'react';
import { DownloadIcon, PdfIcon } from '../icons';

interface ReportExportActionsProps {
  onExportCSV: () => void;
  onExportPDF: () => void;
  isGeneratingPDF: boolean;
}

export default function ReportExportActions({
  onExportCSV,
  onExportPDF,
  isGeneratingPDF
}: ReportExportActionsProps): React.JSX.Element {
  return (
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
  );
}