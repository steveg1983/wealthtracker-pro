import { memo, useEffect } from 'react';
import { CameraIcon, LoadingIcon, AlertCircleIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface CameraStepProps {
  error: string | null;
  isLoading: boolean;
  onCameraCapture: () => void;
  onManualEntry: () => void;
}

export const CameraStep = memo(function CameraStep({ error,
  isLoading,
  onCameraCapture,
  onManualEntry
 }: CameraStepProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('CameraStep component initialized', {
      componentName: 'CameraStep'
    });
  }, []);

  return (
    <div className="text-center space-y-6">
      <div className="mx-auto w-32 h-32 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
        <CameraIcon size={48} className="text-gray-400" />
      </div>
      
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Capture Receipt
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Take a photo of your receipt to automatically extract expense details
        </p>
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-300 text-sm">
          <AlertCircleIcon size={16} className="inline mr-2" />
          {error}
        </div>
      )}
      
      <div className="space-y-3">
        <button
          onClick={onCameraCapture}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <LoadingIcon size={20} className="animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CameraIcon size={20} />
              Take Photo
            </>
          )}
        </button>
        
        <button
          onClick={onManualEntry}
          className="w-full px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Enter Manually
        </button>
      </div>
    </div>
  );
});