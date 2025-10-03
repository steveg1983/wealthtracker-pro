import React, { useEffect, memo } from 'react';
import { Modal, ModalBody, ModalFooter } from '../common/Modal';
import { 
  XIcon, 
  DownloadIcon, 
  CalendarIcon, 
  TagIcon,
  FileTextIcon,
  ImageIcon
} from '../icons';
import type { Document } from '../../services/documentService';
import { useLogger } from '../services/ServiceProvider';

interface DocumentViewerProps {
  document: Document | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (document: Document) => void;
}

export const DocumentViewer = memo(function DocumentViewer({ document,
  isOpen,
  onClose,
  onDownload
 }: DocumentViewerProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('DocumentViewer component initialized', {
      componentName: 'DocumentViewer'
    });
  }, []);

  if (!document) return null;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / 1048576 * 10) / 10 + ' MB';
  };

  const renderPreview = () => {
    if (document.mimeType.startsWith('image/')) {
      return (
        <img
          src={document.fullUrl}
          alt={document.fileName}
          className="max-w-full h-auto rounded-lg"
        />
      );
    }
    
    if (document.mimeType === 'application/pdf') {
      return (
        <iframe
          src={document.fullUrl}
          className="w-full h-96 rounded-lg border border-gray-200 dark:border-gray-700"
          title={document.fileName}
        />
      );
    }

    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        <FileTextIcon size={64} className="mx-auto mb-4 opacity-50" />
        <p>Preview not available for this file type</p>
        <p className="text-sm mt-2">Click download to view the file</p>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Document Viewer" size="xl">
      <ModalBody>
        <div className="space-y-4">
          {/* Document Info */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">
              {document.fileName}
            </h3>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Type:</span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {document.type}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Size:</span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {formatFileSize(document.fileSize)}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-600 dark:text-gray-400">Uploaded:</span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {formatDate(document.uploadDate)}
                </span>
              </div>
            </div>

            {document.notes && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {document.notes}
                </p>
              </div>
            )}

            {document.tags.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <TagIcon size={16} className="text-gray-400" />
                <div className="flex flex-wrap gap-1">
                  {document.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Document Preview */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {renderPreview()}
          </div>

          {/* Extracted Data */}
              {document.extractedData && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    Extracted Information
                  </h4>
                  <div className="space-y-2 text-sm">
                {document.extractedData.amount && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
                      ${document.extractedData.amount.toFixed(2)}
                    </span>
                  </div>
                )}
                {document.extractedData.date && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Date:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {formatDate(document.extractedData.date)}
                    </span>
                  </div>
                )}
                {document.extractedData.merchant && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Merchant:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {document.extractedData.merchant}
                    </span>
                  </div>
                )}
                  </div>
                </div>
              )}
        </div>
      </ModalBody>
      
      <ModalFooter>
        <button
          onClick={() => onDownload(document)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          <DownloadIcon size={16} />
          Download
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          Close
        </button>
      </ModalFooter>
    </Modal>
  );
});
