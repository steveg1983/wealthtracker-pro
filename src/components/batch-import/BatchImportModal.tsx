import React, { memo, useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { PlayIcon, ChevronLeftIcon } from '../icons';
import { LoadingButton } from '../loading/LoadingState';
import { useBatchImport } from './useBatchImport';
import { FileDropZone } from './FileDropZone';
import { FileList } from './FileList';
import { ImportSummaryView } from './ImportSummaryView';
import { TestDataWarning } from './TestDataWarning';
import type { BatchImportModalProps } from './types';
import { logger } from '../../services/loggingService';

const BatchImportModal = memo(function BatchImportModal({ isOpen, onClose }: BatchImportModalProps) {
  const [error, setError] = useState<string | null>(null);
  
  // Initialize component with error handling
  useEffect(() => {
    try {
      if (isOpen) {
        logger.info('BatchImportModal opened', { componentName: 'BatchImportModal' });
        setError(null);
      }
    } catch (error) {
      logger.error('BatchImportModal initialization failed:', error, 'BatchImportModal');
      setError('Failed to initialize batch import. Please try again.');
    }
  }, [isOpen]);

  const {
    files,
    isProcessing,
    currentFileIndex,
    showTestDataWarning,
    setShowTestDataWarning,
    importSummary,
    handleFileSelection,
    handleDrop,
    startBatchImport,
    reset
  } = useBatchImport(onClose);
  
  // Enhanced handlers with error logging
  // Adapt to accept ChangeEvent from file inputs if caller changes later
  const handleEnhancedFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const count = event.target.files?.length || 0;
      logger.debug('File selection initiated', { filesCount: count, componentName: 'BatchImportModal' });
      handleFileSelection(event);
      setError(null);
    } catch (error) {
      logger.error('File selection failed:', error, 'BatchImportModal');
      setError('Failed to select files. Please try again.');
    }
  };
  
  const handleEnhancedDrop = (e: React.DragEvent) => {
    try {
      logger.debug('File drop initiated', { componentName: 'BatchImportModal' });
      handleDrop(e);
      setError(null);
    } catch (error) {
      logger.error('File drop failed:', error, 'BatchImportModal');
      setError('Failed to process dropped files. Please try again.');
    }
  };
  
  const handleEnhancedStartImport = () => {
    try {
      logger.debug('Batch import started', { filesCount: files.length, componentName: 'BatchImportModal' });
      startBatchImport();
      setError(null);
    } catch (error) {
      logger.error('Failed to start batch import:', error, 'BatchImportModal');
      setError('Failed to start import process. Please try again.');
    }
  };
  
  const handleEnhancedReset = () => {
    try {
      logger.debug('Batch import reset', { componentName: 'BatchImportModal' });
      reset();
      setError(null);
    } catch (error) {
      logger.error('Failed to reset batch import:', error, 'BatchImportModal');
      setError('Failed to reset import. Please refresh the page.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        try {
          logger.debug('BatchImportModal closed', { componentName: 'BatchImportModal' });
          onClose();
        } catch (error) {
          logger.error('Failed to close modal:', error, 'BatchImportModal');
        }
      }}
      title="Batch Import Files"
      size="xl"
    >
      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        
        {showTestDataWarning ? (
          <TestDataWarning
            onCancel={() => {
              try {
                logger.debug('Test data warning cancelled', { componentName: 'BatchImportModal' });
                setShowTestDataWarning(false);
              } catch (error) {
                logger.error('Failed to cancel test data warning:', error, 'BatchImportModal');
              }
            }}
            onConfirm={handleEnhancedStartImport}
          />
        ) : importSummary ? (
          <ImportSummaryView
            summary={importSummary}
            onReset={handleEnhancedReset}
            onClose={() => {
              try {
                logger.debug('Import summary closed', { componentName: 'BatchImportModal' });
                onClose();
              } catch (error) {
                logger.error('Failed to close import summary:', error, 'BatchImportModal');
              }
            }}
          />
        ) : (
          <>
            {files.length === 0 ? (
              <FileDropZone
                onFileSelection={handleEnhancedFileSelection}
                onDrop={handleEnhancedDrop}
              />
            ) : (
              <>
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Selected Files ({files.length})
                  </h3>
                  <FileList files={files} currentFileIndex={currentFileIndex} />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={handleEnhancedReset}
                    disabled={isProcessing}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
                  >
                    <ChevronLeftIcon size={20} className="inline mr-1" />
                    Back
                  </button>
                  <LoadingButton
                    onClick={handleEnhancedStartImport}
                    isLoading={isProcessing}
                    disabled={files.length === 0}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    <PlayIcon size={20} className="inline mr-1" />
                    {isProcessing 
                      ? `Processing (${currentFileIndex + 1}/${files.length})...` 
                      : 'Start Import'}
                  </LoadingButton>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
});

export default BatchImportModal;
