import { memo, useEffect } from 'react';
import { FileTextIcon, ImageIcon, XIcon, CheckIcon } from '../icons';
import { DocumentUploadService } from '../../services/documentUploadService';
import type { Document } from '../../services/documentService';
import { logger } from '../../services/loggingService';

interface FileListProps {
  selectedFiles: File[];
  uploadedDocs: Document[];
  uploadProgress: Record<string, number>;
  errors: Record<string, string>;
  uploading: boolean;
  onRemoveFile: (index: number) => void;
}

/**
 * File list display component
 */
export const FileList = memo(function FileList({
  selectedFiles,
  uploadedDocs,
  uploadProgress,
  errors,
  uploading,
  onRemoveFile
}: FileListProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('FileList component initialized', {
      componentName: 'FileList'
    });
  }, []);

  const getFileIcon = (mimeType: string) => {
    const iconType = DocumentUploadService.getFileIconType(mimeType);
    if (iconType === 'image') {
      return <ImageIcon size={20} className="text-gray-600" />;
    }
    if (iconType === 'pdf') {
      return <FileTextIcon size={20} className="text-red-600" />;
    }
    return <FileTextIcon size={20} className="text-gray-600" />;
  };

  return (
    <>
      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-gray-900 dark:text-white">
            Selected Files ({selectedFiles.length})
          </h3>
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <div className="flex items-center gap-3">
                {getFileIcon(file.type)}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {DocumentUploadService.formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {uploadProgress[file.name] !== undefined && (
                  <div className="w-20">
                    <div className="h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-600 transition-all duration-300"
                        style={{ width: `${uploadProgress[file.name]}%` }}
                      />
                    </div>
                  </div>
                )}
                {errors[file.name] && (
                  <span className="text-xs text-red-600 dark:text-red-400">
                    {errors[file.name]}
                  </span>
                )}
                {!uploading && (
                  <button
                    onClick={() => onRemoveFile(index)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <XIcon size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Documents */}
      {uploadedDocs.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <CheckIcon size={16} className="text-green-600" />
            Uploaded Documents ({uploadedDocs.length})
          </h3>
          {uploadedDocs.map(doc => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700"
            >
              <div className="flex items-center gap-3">
                {getFileIcon(doc.mimeType)}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {doc.fileName}
                  </p>
                  {doc.extractedData && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {doc.extractedData.merchant && `Merchant: ${doc.extractedData.merchant}`}
                      {doc.extractedData.totalAmount && ` • £${doc.extractedData.totalAmount}`}
                    </p>
                  )}
                </div>
              </div>
              <CheckIcon size={20} className="text-green-600" />
            </div>
          ))}
        </div>
      )}
    </>
  );
});