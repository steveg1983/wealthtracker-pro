/**
 * File Upload Section Component
 * Handles OFX file upload via drag-drop or file picker
 */

import React, { useEffect, memo } from 'react';
import { UploadIcon, FileTextIcon, InfoIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface FileUploadSectionProps {
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: React.DragEvent) => void;
}

export const FileUploadSection = memo(function FileUploadSection({ onFileUpload,
  onDrop
 }: FileUploadSectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('FileUploadSection component initialized', {
      componentName: 'FileUploadSection'
    });
  }, []);

  return (
    <>
      {/* File Upload */}
      <div
        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <UploadIcon size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Upload OFX File
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Drag and drop your .ofx file here, or click to browse
        </p>
        <input
          type="file"
          accept=".ofx"
          onChange={onFileUpload}
          className="hidden"
          id="ofx-upload"
        />
        <label
          htmlFor="ofx-upload"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary cursor-pointer"
        >
          <FileTextIcon size={20} />
          Select OFX File
        </label>
      </div>
      
      {/* Info Box */}
      <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
        <div className="flex items-start gap-3">
          <InfoIcon className="text-amber-600 dark:text-amber-400 mt-0.5" size={20} />
          <div className="text-sm">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
              About OFX Files
            </h4>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              OFX (Open Financial Exchange) files contain standardized financial data exported from banks and credit card companies.
            </p>
            <ul className="text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Automatic duplicate detection using transaction IDs</li>
              <li>• Smart account matching based on account numbers</li>
              <li>• Preserves transaction reference numbers</li>
              <li>• Imports cleared transactions with exact dates</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
});