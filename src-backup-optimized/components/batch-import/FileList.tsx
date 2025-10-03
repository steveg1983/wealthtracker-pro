import React, { useEffect, memo } from 'react';
import { CheckIcon, XIcon, FileTextIcon } from '../icons';
import { FILE_ICONS } from './types';
import type { FileInfo } from './types';
import { useLogger } from '../services/ServiceProvider';

interface FileListProps {
  files: FileInfo[];
  currentFileIndex: number;
}

export const FileList = memo(function FileList({ files, currentFileIndex  }: FileListProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('FileList component initialized', {
      componentName: 'FileList'
    });
  }, []);

  const getStatusIcon = (status: FileInfo['status']) => {
    switch (status) {
      case 'success': return <CheckIcon size={16} className="text-green-600" />;
      case 'error': return <XIcon size={16} className="text-red-600" />;
      case 'processing': return <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {files.map((file, index) => (
        <div
          key={index}
          className={`flex items-center justify-between p-3 rounded-lg ${
            index === currentFileIndex 
              ? 'bg-primary/10 border-primary' 
              : 'bg-gray-50 dark:bg-gray-700/50'
          } border ${file.status === 'error' ? 'border-red-500' : 'border-transparent'}`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{FILE_ICONS[file.type]}</span>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {file.size} • {file.type.toUpperCase()}
                {file.accountMatched && ` • ${file.accountMatched}`}
              </p>
              {file.status === 'success' && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ {file.imported} imported, {file.duplicates} duplicates skipped
                </p>
              )}
              {file.error && (
                <p className="text-xs text-red-600 mt-1">{file.error}</p>
              )}
            </div>
          </div>
          {getStatusIcon(file.status)}
        </div>
      ))}
    </div>
  );
});