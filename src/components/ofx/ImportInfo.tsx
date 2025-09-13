/**
 * Import Info Component
 * Displays information about OFX file import
 */

import React, { useEffect } from 'react';
import { InfoIcon } from '../icons';
import { logger } from '../../services/loggingService';

const ImportInfo = React.memo(() => {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-l-4 border-blue-400 dark:border-blue-600">
      <div className="flex items-start space-x-3">
        <InfoIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
            About OFX Files
          </h4>
          <p className="text-xs text-blue-700 dark:text-blue-400 mb-2">
            OFX (Open Financial Exchange) files contain standardized financial data exported from banks and credit card companies.
          </p>
          <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Automatic duplicate detection using transaction IDs</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Smart account matching based on account numbers</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Preserves transaction reference numbers</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Imports cleared transactions with exact dates</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
});

ImportInfo.displayName = 'ImportInfo';

export default ImportInfo;