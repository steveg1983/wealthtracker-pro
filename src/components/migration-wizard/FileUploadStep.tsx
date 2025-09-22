import { memo, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadIcon, FileTextIcon, XIcon } from '../icons';
import type { MigrationSource, MigrationSourceConfig } from '../../services/migrationWizardService';
import { useLogger } from '../services/ServiceProvider';

interface FileUploadStepProps {
  source: MigrationSourceConfig | undefined;
  uploadedFiles: File[];
  onDrop: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  acceptConfig: Record<string, string[]> | undefined;
}

/**
 * File upload step component
 * Extracted from DataMigrationWizard for single responsibility
 */
export const FileUploadStep = memo(function FileUploadStep({ source,
  uploadedFiles,
  onDrop,
  onRemoveFile,
  acceptConfig
 }: FileUploadStepProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('FileUploadStep component initialized', {
      componentName: 'FileUploadStep'
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptConfig,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  if (!source) return <></>;

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Upload Your Data Files
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        {source.instructions}
      </p>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <UploadIcon size={48} className="mx-auto mb-4 text-gray-400" />
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          {isDragActive
            ? 'Drop the files here...'
            : 'Drag & drop files here, or click to select'}
        </p>
        <p className="text-xs text-gray-500">
          Supported formats: {source.fileTypes.join(', ')}
        </p>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            Uploaded Files ({uploadedFiles.length})
          </h4>
          {uploadedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <FileTextIcon size={20} className="text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => onRemoveFile(index)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                aria-label="Remove file"
              >
                <XIcon size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});