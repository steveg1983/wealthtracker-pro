import React, { useEffect, memo, useCallback } from 'react';
import { useLogger } from '../services/ServiceProvider';
import { 
  UploadIcon, 
  FileTextIcon, 
  XIcon,
  AlertCircleIcon
} from '../icons';

export interface FileInfo {
  file: File;
  name: string;
  size: string;
  type: 'csv' | 'ofx' | 'qif' | 'unknown';
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
  imported?: number;
  duplicates?: number;
  bankFormat?: string;
}

interface FileUploadStepProps {
  files: FileInfo[];
  onFilesAdd: (files: FileInfo[]) => void;
  onFileRemove: (index: number) => void;
}

export const FileUploadStep = memo(function FileUploadStep({ files,
  onFilesAdd,
  onFileRemove
 }: FileUploadStepProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('FileUploadStep component initialized', {
      componentName: 'FileUploadStep'
    });
  }, []);

  const detectFileType = (filename: string): FileInfo['type'] => {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'csv': return 'csv';
      case 'ofx': return 'ofx';
      case 'qif': return 'qif';
      default: return 'unknown';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    else return Math.round(bytes / 1048576) + ' MB';
  };

  const handleFileSelection = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const fileInfos: FileInfo[] = selectedFiles.map(file => ({
      file,
      name: file.name,
      size: formatFileSize(file.size),
      type: detectFileType(file.name),
      status: 'pending'
    }));
    
    const validFiles = fileInfos.filter(f => f.type !== 'unknown');
    const invalidFiles = fileInfos.filter(f => f.type === 'unknown');
    
    if (invalidFiles.length > 0) {
      alert(`Unsupported file types: ${invalidFiles.map(f => f.name).join(', ')}`);
    }
    
    onFilesAdd(validFiles);
  }, [onFilesAdd]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files);
    const fileInfos: FileInfo[] = droppedFiles.map(file => ({
      file,
      name: file.name,
      size: formatFileSize(file.size),
      type: detectFileType(file.name),
      status: 'pending'
    }));
    
    const validFiles = fileInfos.filter(f => f.type !== 'unknown');
    const invalidFiles = fileInfos.filter(f => f.type === 'unknown');
    
    if (invalidFiles.length > 0) {
      alert(`Unsupported file types: ${invalidFiles.map(f => f.name).join(', ')}`);
    }
    
    onFilesAdd(validFiles);
  }, [onFilesAdd]);

  const getFileIcon = (type: FileInfo['type']) => {
    switch (type) {
      case 'csv': return <FileTextIcon size={20} className="text-green-600" />;
      case 'ofx': return <FileTextIcon size={20} className="text-blue-600" />;
      case 'qif': return <FileTextIcon size={20} className="text-purple-600" />;
      default: return <FileTextIcon size={20} className="text-gray-600" />;
    }
  };

  const getStatusColor = (status: FileInfo['status']) => {
    switch (status) {
      case 'processing': return 'text-blue-600';
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <UploadIcon size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Drop files here or click to browse
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Supports CSV, OFX, and QIF files
        </p>
        <input
          id="file-input"
          type="file"
          multiple
          accept=".csv,.ofx,.qif"
          onChange={handleFileSelection}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex items-center gap-3">
                {getFileIcon(file.type)}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>{file.size}</span>
                    <span>•</span>
                    <span className={getStatusColor(file.status)}>
                      {file.status === 'processing' && 'Processing...'}
                      {file.status === 'success' && `Imported ${file.imported} transactions`}
                      {file.status === 'error' && (file.error || 'Import failed')}
                      {file.status === 'pending' && 'Ready to import'}
                    </span>
                    {file.duplicates && file.duplicates > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-yellow-600">
                          {file.duplicates} duplicates skipped
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {file.status === 'pending' && (
                <button
                  onClick={() => onFileRemove(index)}
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <XIcon size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {files.some(f => f.type === 'csv') && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex gap-3">
            <AlertCircleIcon size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <p className="font-medium mb-1">CSV Import Tips:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Select your bank format on the next screen for automatic mapping</li>
                <li>Ensure your CSV has headers for better column detection</li>
                <li>Date formats are automatically detected</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});