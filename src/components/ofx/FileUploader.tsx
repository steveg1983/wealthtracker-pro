/**
 * File Uploader Component
 * Handles OFX file upload and drag-drop
 */

import React, { useEffect, useRef } from 'react';
import { UploadIcon, FileTextIcon } from '../icons';
import { ofxImportModalService } from '../../services/ofxImportModalService';
import { logger } from '../../services/loggingService';

interface FileUploaderProps {
  file: File | null;
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

const FileUploader = React.memo(({
  file,
  onFileSelect,
  isProcessing
}: FileUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile && ofxImportModalService.isValidOFXFile(droppedFile.name)) {
      onFileSelect(droppedFile);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  return (
    <div className="space-y-4">
      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            Click to upload or drag and drop
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            OFX files only
          </p>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <FileTextIcon className="h-8 w-8 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {file.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {ofxImportModalService.formatFileSize(file.size)}
              </p>
            </div>
            {!isProcessing && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-sm text-[var(--color-primary)] hover:underline"
              >
                Change file
              </button>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".ofx"
        onChange={handleFileChange}
        className="hidden"
        disabled={isProcessing}
      />
    </div>
  );
});

FileUploader.displayName = 'FileUploader';

export default FileUploader;