import React, { useEffect, memo } from 'react';
import { PaperclipIcon, FileTextIcon, ImageIcon } from '../icons';
import DocumentUpload from '../DocumentUpload';
import type { Document } from '../../services/documentService';
import { logger } from '../../services/loggingService';

interface CompactDocumentListProps {
  documents: Document[];
  transactionId?: string;
  accountId?: string;
  onUploadComplete: (document: Document) => void;
  onDocumentClick: (document: Document) => void;
  onShowMore?: () => void;
}

export const CompactDocumentList = memo(function CompactDocumentList({
  documents,
  transactionId,
  accountId,
  onUploadComplete,
  onDocumentClick,
  onShowMore
}: CompactDocumentListProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('CompactDocumentList component initialized', {
      componentName: 'CompactDocumentList'
    });
  }, []);

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <ImageIcon size={20} className="text-gray-600" />;
    }
    if (mimeType === 'application/pdf') {
      return <FileTextIcon size={20} className="text-red-600" />;
    }
    return <FileTextIcon size={20} className="text-gray-600" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PaperclipIcon size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Attachments ({documents.length})
          </span>
        </div>
        <DocumentUpload
          transactionId={transactionId}
          accountId={accountId}
          onUploadComplete={onUploadComplete}
          compact
        />
      </div>
      
      {documents.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {documents.slice(0, 4).map(doc => (
            <button
              key={doc.id}
              onClick={() => onDocumentClick(doc)}
              className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-left"
            >
              {getFileIcon(doc.mimeType)}
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                {doc.fileName}
              </span>
            </button>
          ))}
          {documents.length > 4 && (
            <button
              onClick={onShowMore}
              className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-center text-sm text-gray-600 dark:text-gray-400"
            >
              +{documents.length - 4} more
            </button>
          )}
        </div>
      )}
    </div>
  );
});