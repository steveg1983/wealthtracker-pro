import { memo, useRef, useEffect } from 'react';
import { UploadIcon, CameraIcon } from '../icons';
import { DocumentUploadService } from '../../services/documentUploadService';
import { useLogger } from '../services/ServiceProvider';

interface UploadAreaProps {
  isCameraSupported: boolean;
  onFilesSelected: (files: File[]) => void;
  onCameraCapture: (files: File[]) => void;
}

/**
 * Document upload area component
 */
export const UploadArea = memo(function UploadArea({ isCameraSupported,
  onFilesSelected,
  onCameraCapture
 }: UploadAreaProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('UploadArea component initialized', {
      componentName: 'UploadArea'
    });
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    onFilesSelected(files);
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleCameraCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      onCameraCapture(files);
    }
    if (event.target) {
      event.target.value = '';
    }
  };

  return (
    <div
      onDrop={(e) => onFilesSelected(DocumentUploadService.handleFileDrop(e))}
      onDragOver={DocumentUploadService.handleDragOver}
      className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
    >
      <UploadIcon size={48} className="mx-auto mb-4 text-gray-400" />
      <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        Drop files here or click to browse
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Supported: Images, PDFs, Word docs, Excel files (max 10MB)
      </p>
      
      <div className="flex items-center justify-center gap-3">
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
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          <UploadIcon size={16} />
          Select Files
        </button>
        
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCameraCapture}
          className="hidden"
        />
        {isCameraSupported && (
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            title="Take a photo of your receipt"
          >
            <CameraIcon size={16} />
            Take Photo
          </button>
        )}
      </div>
    </div>
  );
});