import { memo, useEffect, useCallback } from 'react';
import { UploadIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface FileUploadZoneProps {
  file: File | null;
  parsing: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * File upload zone component
 * Handles file selection UI for import
 */
export const FileUploadZone = memo(function FileUploadZone({
  file,
  parsing,
  onFileChange
}: FileUploadZoneProps): React.JSX.Element {
  // Component initialization logging with error handling
  useEffect(() => {
    try {
      logger.info('FileUploadZone component initialized', {
        hasFile: !!file,
        parsing,
        componentName: 'FileUploadZone'
      });
    } catch (error) {
      logger.error('FileUploadZone initialization failed:', error);
    }
  }, [file, parsing]);

  // Optimized file change handler with error handling
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      logger.debug('File selection changed', { 
        fileName: e.target.files?.[0]?.name,
        componentName: 'FileUploadZone'
      });
      onFileChange(e);
    } catch (error) {
      logger.error('File change handler failed:', error);
    }
  }, [onFileChange]);

  try {
    return (
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
      {parsing ? (
        <>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Parsing file...</p>
        </>
      ) : (
        <>
          <UploadIcon className="mx-auto text-gray-400 mb-4" size={48} />
          <label className="cursor-pointer">
            <span className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors inline-block">
              Choose File
            </span>
            <input
              type="file"
              accept=".mny,.mbf,.qif,.ofx,.csv"
              onChange={handleFileChange}
              className="hidden"
              disabled={parsing}
            />
          </label>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {file ? file.name : 'No file selected'}
          </p>
        </>
      )}
      </div>
    );
  } catch (error) {
    logger.error('FileUploadZone render failed:', error);
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <div className="text-red-600 dark:text-red-400 text-sm">
          ⚠️ File upload unavailable
        </div>
      </div>
    );
  }
});
