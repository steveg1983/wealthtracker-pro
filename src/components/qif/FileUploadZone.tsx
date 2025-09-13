/**
 * File Upload Zone Component
 * World-class drag & drop with Stripe-level UX
 */

import React, { useEffect, memo } from 'react';
import { UploadIcon, FileTextIcon, InfoIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface FileUploadZoneProps {
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: React.DragEvent) => void;
}

/**
 * Premium file upload zone with enterprise styling
 */
export const FileUploadZone = memo(function FileUploadZone({
  onFileUpload,
  onDrop
}: FileUploadZoneProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('FileUploadZone component initialized', {
      componentName: 'FileUploadZone'
    });
  }, []);

  return (
    <>
      <UploadArea onDrop={onDrop} onFileUpload={onFileUpload} />
      <FileInfoCard />
    </>
  );
});

/**
 * Drag & drop upload area
 */
const UploadArea = memo(function UploadArea({
  onDrop,
  onFileUpload
}: {
  onDrop: (event: React.DragEvent) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}): React.JSX.Element {
  return (
    <div
      className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <UploadIcon size={48} className="mx-auto text-gray-400 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Upload QIF File
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Drag and drop your .qif file here, or click to browse
      </p>
      <FileInput onFileUpload={onFileUpload} />
    </div>
  );
});

/**
 * File input with custom label
 */
const FileInput = memo(function FileInput({
  onFileUpload
}: {
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}): React.JSX.Element {
  return (
    <>
      <input
        type="file"
        accept=".qif"
        onChange={onFileUpload}
        className="hidden"
        id="qif-upload"
      />
      <label
        htmlFor="qif-upload"
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <FileTextIcon size={20} />
        Select QIF File
      </label>
    </>
  );
});

/**
 * File format information card
 */
const FileInfoCard = memo(function FileInfoCard(): React.JSX.Element {
  return (
    <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
      <div className="flex items-start gap-3">
        <InfoIcon className="text-amber-600 dark:text-amber-400 mt-0.5" size={20} />
        <div className="text-sm">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
            About QIF Files
          </h4>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            QIF (Quicken Interchange Format) is a simple text format for financial data.
          </p>
          <FeatureList />
        </div>
      </div>
    </div>
  );
});

/**
 * Feature list
 */
const FeatureList = memo(function FeatureList(): React.JSX.Element {
  const features = [
    'Widely supported by UK banks and financial software',
    'Simple format but no unique transaction IDs',
    'Requires manual account selection',
    'Best for one-time imports or initial setup'
  ];

  return (
    <ul className="text-gray-600 dark:text-gray-400 space-y-1">
      {features.map((feature, index) => (
        <li key={index}>• {feature}</li>
      ))}
    </ul>
  );
});