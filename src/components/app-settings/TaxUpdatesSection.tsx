import React, { useEffect, memo } from 'react';
import { RefreshCwIcon, CheckCircleIcon, AlertCircleIcon, XCircleIcon } from '../icons';
import type { TaxUpdateResult } from '../../services/appSettingsService';
import { useLogger } from '../services/ServiceProvider';

interface TaxUpdatesSectionProps {
  region: string;
  isChecking: boolean;
  updateResult: TaxUpdateResult;
  dataSource: string;
  verificationSource: string;
  onCheckUpdates: () => void;
}

const TaxUpdatesSection = memo(function TaxUpdatesSection({ region,
  isChecking,
  updateResult,
  dataSource,
  verificationSource,
  onCheckUpdates
 }: TaxUpdatesSectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('TaxUpdatesSection component initialized', {
      componentName: 'TaxUpdatesSection'
    });
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tax Data Updates</h3>
      
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Keep your tax calculations accurate with the latest rates from official sources.
          We verify data against {verificationSource}.
        </p>
        
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-gray-900 dark:text-white">
                Check for Updates
              </h4>
              {updateResult.verificationStatus === 'valid' && (
                <CheckCircleIcon size={16} className="text-green-500" />
              )}
              {updateResult.verificationStatus === 'needs_update' && (
                <AlertCircleIcon size={16} className="text-yellow-500" />
              )}
              {updateResult.verificationStatus === 'invalid' && (
                <XCircleIcon size={16} className="text-red-500" />
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manually verify tax data against official sources
            </p>
            {updateResult.message && (
              <p className={`text-xs mt-2 ${
                updateResult.status === 'error' ? 'text-red-600 dark:text-red-400' :
                updateResult.status === 'success' ? 'text-green-600 dark:text-green-400' :
                'text-gray-600 dark:text-gray-400'
              }`}>
                {updateResult.message}
              </p>
            )}
            {updateResult.lastChecked && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Last checked: {updateResult.lastChecked.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            onClick={onCheckUpdates}
            disabled={isChecking}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              isChecking
                ? 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-primary-dark'
            }`}
          >
            <RefreshCwIcon 
              size={16} 
              className={isChecking ? 'animate-spin' : ''} 
            />
            {isChecking ? 'Checking...' : 'Check Now'}
          </button>
        </div>
        
        <div className="p-4 bg-blue-50 dark:bg-gray-900/20 rounded-xl">
          <div className="flex items-start gap-2">
            <AlertCircleIcon size={16} className="text-gray-600 dark:text-gray-500 mt-0.5" />
            <div className="text-xs text-blue-700 dark:text-gray-300 space-y-1">
              <p>
                <strong>Automatic Updates:</strong> Tax data is checked daily in the background.
              </p>
              <p>
                <strong>Regional Detection:</strong> Currently set to {region} based on your locale.
              </p>
              <p>
                <strong>Data Sources:</strong> {dataSource}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default TaxUpdatesSection;