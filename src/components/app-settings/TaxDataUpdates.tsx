import React, { useState } from 'react';
import { RefreshCwIcon, CheckCircleIcon, XCircleIcon, AlertCircleIcon } from '../icons';
import { appSettingsService, type TaxUpdateResult } from '../../services/appSettingsService';

interface TaxDataUpdatesProps {
  region: string;
}

export default function TaxDataUpdates({
  region
}: TaxDataUpdatesProps): React.JSX.Element {
  const [isCheckingTaxUpdates, setIsCheckingTaxUpdates] = useState(false);
  const [taxUpdateResult, setTaxUpdateResult] = useState<TaxUpdateResult>({ 
    status: 'idle', 
    message: '' 
  });

  const handleCheckTaxUpdates = async (): Promise<void> => {
    setIsCheckingTaxUpdates(true);
    setTaxUpdateResult({ status: 'checking', message: 'Checking for tax data updates...' });
    
    const result = await appSettingsService.checkTaxUpdates(region);
    setTaxUpdateResult(result);
    setIsCheckingTaxUpdates(false);
  };

  const getStatusIcon = () => {
    switch (taxUpdateResult.verificationStatus) {
      case 'valid':
        return <CheckCircleIcon size={16} className="text-green-500" />;
      case 'needs_update':
        return <AlertCircleIcon size={16} className="text-yellow-500" />;
      case 'invalid':
        return <XCircleIcon size={16} className="text-red-500" />;
      default:
        return null;
    }
  };

  const getMessageColor = () => {
    switch (taxUpdateResult.status) {
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'success':
        return 'text-green-600 dark:text-green-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tax Data Updates</h3>
      
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Keep your tax calculations accurate with the latest rates from official sources.
          We verify data against {appSettingsService.getTaxVerificationSource(region)}.
        </p>
        
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-gray-900 dark:text-white">
                Check for Updates
              </h4>
              {getStatusIcon()}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manually verify tax data against official sources
            </p>
            {taxUpdateResult.message && (
              <p className={`text-xs mt-2 ${getMessageColor()}`}>
                {taxUpdateResult.message}
              </p>
            )}
            {taxUpdateResult.lastChecked && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Last checked: {taxUpdateResult.lastChecked.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            onClick={handleCheckTaxUpdates}
            disabled={isCheckingTaxUpdates}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              isCheckingTaxUpdates
                ? 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-primary-dark'
            }`}
          >
            <RefreshCwIcon 
              size={16} 
              className={isCheckingTaxUpdates ? 'animate-spin' : ''} 
            />
            {isCheckingTaxUpdates ? 'Checking...' : 'Check Now'}
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
                <strong>Data Sources:</strong> {appSettingsService.getTaxDataSource(region)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}