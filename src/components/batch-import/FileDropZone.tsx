import React, { useEffect, memo, useRef } from 'react';
import { UploadIcon, FolderIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface FileDropZoneProps {
  onFileSelection: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: React.DragEvent) => void;
}

export const FileDropZone = memo(function FileDropZone({ onFileSelection, 
  onDrop 
 }: FileDropZoneProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('FileDropZone component initialized', {
      componentName: 'FileDropZone'
    });
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-primary', 'bg-primary/5');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
  };

  const handleDropComplete = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
    onDrop(e);
  };

  return (
    <div
      className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center transition-colors"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropComplete}
    >
      <UploadIcon size={48} className="mx-auto text-gray-400 mb-4" />
      <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        Drop files here or click to browse
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Supports CSV, OFX, and QIF files
      </p>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".csv,.ofx,.qif"
        onChange={onFileSelection}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 inline-flex items-center gap-2"
      >
        <FolderIcon size={20} />
        Select Files
      </button>
    </div>
  );
});