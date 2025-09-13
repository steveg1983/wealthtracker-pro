import React, { useEffect, memo } from 'react';
import {
  FileTextIcon,
  ImageIcon,
  DownloadIcon,
  DeleteIcon,
  EditIcon,
  EyeIcon,
  CalendarIcon,
  TagIcon
} from '../icons';
import type { Document } from '../../services/documentService';
import { logger } from '../../services/loggingService';

interface DocumentListProps {
  documents: Document[];
  onView: (document: Document) => void;
  onEdit: (document: Document) => void;
  onDelete: (documentId: string) => void;
  onDownload: (document: Document) => void;
}

export const DocumentList = memo(function DocumentList({
  documents,
  onView,
  onEdit,
  onDelete,
  onDownload
}: DocumentListProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('DocumentList component initialized', {
      componentName: 'DocumentList'
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

  const getTypeColor = (type: Document['type']) => {
    switch (type) {
      case 'receipt': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'invoice': return 'bg-blue-100 text-blue-800 dark:bg-gray-900/20 dark:text-gray-500';
      case 'statement': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'contract': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / 1048576 * 10) / 10 + ' MB';
  };

  if (documents.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
        <FileTextIcon size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No documents found
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Upload documents to get started
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="grid gap-4 p-4">
        {documents.map(doc => (
          <div
            key={doc.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {/* File Icon */}
                <div className="flex-shrink-0 mt-1">
                  {getFileIcon(doc.mimeType)}
                </div>

                {/* Document Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">
                      {doc.fileName}
                    </h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(doc.type)}`}>
                      {doc.type}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <CalendarIcon size={14} />
                      {formatDate(doc.uploadDate)}
                    </span>
                    <span>{formatFileSize(doc.fileSize)}</span>
                  </div>

                  {doc.notes && (
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                      {doc.notes}
                    </p>
                  )}

                  {doc.tags.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <TagIcon size={14} className="text-gray-400" />
                      <div className="flex flex-wrap gap-1">
                        {doc.tags.map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onView(doc)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  title="View"
                >
                  <EyeIcon size={18} />
                </button>
                <button
                  onClick={() => onDownload(doc)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  title="Download"
                >
                  <DownloadIcon size={18} />
                </button>
                <button
                  onClick={() => onEdit(doc)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  title="Edit"
                >
                  <EditIcon size={18} />
                </button>
                <button
                  onClick={() => onDelete(doc.id)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  title="Delete"
                >
                  <DeleteIcon size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
