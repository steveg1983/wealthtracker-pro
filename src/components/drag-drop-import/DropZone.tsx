import { memo, useEffect } from 'react';
import { UploadIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface DropZoneProps {
  isDragging: boolean;
  isProcessing: boolean;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: () => void;
}

/**
 * Drop zone component for file uploads
 * Handles drag and drop visual feedback
 */
export const DropZone = memo(function DropZone({ isDragging,
  isProcessing,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileSelect
 }: DropZoneProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('DropZone component initialized', {
      componentName: 'DropZone'
    });
  }, []);

  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`
        relative border-2 border-dashed rounded-lg p-8 text-center transition-all
        ${isDragging 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
          : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
        }
        ${isProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
      `}
      onClick={!isProcessing ? onFileSelect : undefined}
    >
      <UploadIcon 
        size={48} 
        className={`mx-auto mb-4 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} 
      />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {isDragging ? 'Drop your file here' : 'Drop files to import'}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        or click to browse your files
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-500">
        Supported formats: CSV, QIF, OFX/QFX
      </p>
      
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500/10 rounded-lg pointer-events-none">
          <div className="flex items-center justify-center h-full">
            <div className="bg-blue-500 text-white px-4 py-2 rounded-lg">
              Release to upload
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
