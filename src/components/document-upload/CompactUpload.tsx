import { memo, useRef, useEffect } from 'react';
import { PaperclipIcon } from '../icons';
import { DocumentUploadService } from '../../services/documentUploadService';
import type { Document } from '../../services/documentService';
import { logger } from '../../services/loggingService';

interface CompactUploadProps {
  uploadedDocs: Document[];
  onFilesSelected: (files: File[]) => void;
}

/**
 * Compact document upload component
 */
export const CompactUpload = memo(function CompactUpload({
  uploadedDocs,
  onFilesSelected
}: CompactUploadProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('CompactUpload component initialized', {
      componentName: 'CompactUpload'
    });
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    onFilesSelected(files);
    if (event.target) {
      event.target.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={DocumentUploadService.SUPPORTED_FILE_TYPES}
        onChange={handleFileSelection}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
      >
        <PaperclipIcon size={16} />
        Attach
      </button>
      {uploadedDocs.length > 0 && (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {uploadedDocs.length} file{uploadedDocs.length > 1 ? 's' : ''} attached
        </span>
      )}
    </div>
  );
});