import React, { useEffect, memo } from 'react';
import { format } from 'date-fns';
import { XIcon, InfoIcon } from '../icons';
import type { Anomaly } from '../../services/anomalyDetectionService';
import { useLogger } from '../services/ServiceProvider';

interface AnomalyDetailsProps {
  anomaly: Anomaly | null;
  onClose: () => void;
}

export const AnomalyDetails = memo(function AnomalyDetails({ anomaly,
  onClose
 }: AnomalyDetailsProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('AnomalyDetails component initialized', {
      componentName: 'AnomalyDetails'
    });
  }, []);

  if (!anomaly) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Anomaly Details
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <XIcon size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</h4>
            <p className="text-gray-900 dark:text-white capitalize">
              {anomaly.type.replace('_', ' ')}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Severity</h4>
            <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
              anomaly.severity === 'high' ? 'bg-red-100 text-red-800' :
              anomaly.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {anomaly.severity.toUpperCase()}
            </span>
          </div>

          {/* Optional message field (not always present in type) */}
          {'message' in (anomaly as any) && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Message</h4>
              <p className="text-gray-900 dark:text-white">{(anomaly as any).message}</p>
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</h4>
            <p className="text-gray-900 dark:text-white">{anomaly.description}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Detected</h4>
            <p className="text-gray-900 dark:text-white">
              {format(new Date(anomaly.detectedAt), 'PPpp')}
            </p>
          </div>

          {Boolean((anomaly as any).metadata) && Object.keys((anomaly as any).metadata || {}).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Additional Information
              </h4>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
                {Object.entries((anomaly as any).metadata || {}).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {key.replace('_', ' ')}:
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {typeof value === 'number' && key.includes('amount')
                        ? `$${(value as number).toFixed(2)}`
                        : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 flex items-start gap-2">
            <InfoIcon size={16} className="text-blue-600 dark:text-blue-400 mt-0.5" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              This anomaly was detected based on your transaction patterns and configured sensitivity settings.
            </p>
          </div>
        </div>

        <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
});
