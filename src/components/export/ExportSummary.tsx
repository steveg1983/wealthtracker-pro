/**
 * Export Summary Component
 * Displays summary of export settings
 */

import React, { useEffect } from 'react';
import { exportModalService } from '../../services/exportModalService';
import type { ExportFormat } from '../../services/exportModalService';
import { logger } from '../../services/loggingService';

interface ExportSummaryProps {
  selectedFormat: ExportFormat;
  startDate: string;
  endDate: string;
  transactionCount: number;
}

const ExportSummary = React.memo(({
  selectedFormat,
  startDate,
  endDate,
  transactionCount
}: ExportSummaryProps) => {
  const summaryItems = exportModalService.getExportSummary(
    selectedFormat,
    startDate,
    endDate,
    transactionCount
  );

  return (
    <div className="bg-blue-50 dark:bg-gray-900 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
        Export Summary
      </h4>
      <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
        {summaryItems.map((item, index) => (
          <li key={index}>• {item}</li>
        ))}
      </ul>
    </div>
  );
});

ExportSummary.displayName = 'ExportSummary';

export default ExportSummary;