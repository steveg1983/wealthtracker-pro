import { memo, useEffect } from 'react';
import { MapPinIcon } from '../icons';
import type { MerchantLocation } from '../../services/mobileService';
import { logger } from '../../services/loggingService';

interface LocationStepProps {
  nearbyMerchants: MerchantLocation[];
  onMerchantSelect: (merchant: MerchantLocation | null) => void;
}

export const LocationStep = memo(function LocationStep({
  nearbyMerchants,
  onMerchantSelect
}: LocationStepProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('LocationStep component initialized', {
      componentName: 'LocationStep'
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <MapPinIcon size={32} className="mx-auto mb-4 text-gray-600 dark:text-gray-500" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Select Merchant
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          We found these nearby merchants. Select one or continue without location.
        </p>
      </div>
      
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {nearbyMerchants.map((merchant, index) => (
          <button
            key={index}
            onClick={() => onMerchantSelect(merchant)}
            className="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:border-[var(--color-primary)] hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {merchant.name}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {merchant.address}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {merchant.distance?.toFixed(1)} mi
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
      
      <div className="flex gap-3">
        <button
          onClick={() => onMerchantSelect(null)}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Skip Location
        </button>
      </div>
    </div>
  );
});