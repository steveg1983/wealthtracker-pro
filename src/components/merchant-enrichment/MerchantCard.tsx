import { memo, useEffect } from 'react';
import { BuildingIcon, TagIcon, StarIcon, EditIcon, EyeIcon } from '../icons';
import { MerchantEnrichmentService } from '../../services/merchantEnrichmentService';
import type { MerchantData } from '../../services/dataIntelligenceService';
import { logger } from '../../services/loggingService';

interface MerchantCardProps {
  merchant: MerchantData;
  onEdit?: (merchant: MerchantData) => void;
  onView?: (merchant: MerchantData) => void;
  onUpdate?: (merchant: MerchantData) => void;
  isSelected?: boolean;
  showCheckbox?: boolean;
}

export const MerchantCard = memo(function MerchantCard({
  merchant,
  onEdit,
  onView
}: MerchantCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('MerchantCard component initialized', {
      componentName: 'MerchantCard'
    });
  }, []);

  const confidenceColor = MerchantEnrichmentService.getConfidenceColor(merchant.confidence);
  const confidenceBg = MerchantEnrichmentService.getConfidenceBackground(merchant.confidence);
  const frequencyLabel = MerchantEnrichmentService.getFrequencyLabel(merchant.frequency);
  const frequencyColor = MerchantEnrichmentService.getFrequencyColor(merchant.frequency);
  const lastUpdated = MerchantEnrichmentService.formatLastUpdated(merchant.lastUpdated);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <BuildingIcon size={20} className="text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">
              {merchant.cleanName}
            </h3>
            {merchant.name !== merchant.cleanName && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Original: {merchant.name}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">
                {merchant.category}
              </span>
              <span className={`text-xs ${frequencyColor}`}>
                {frequencyLabel}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onView && (
            <button
              onClick={() => onView(merchant)}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="View details"
            >
              <EyeIcon size={16} />
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(merchant)}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Edit merchant"
            >
              <EditIcon size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">Confidence</span>
          <div className="flex items-center gap-2">
            <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${confidenceBg}`}
                style={{ width: `${merchant.confidence * 100}%` }}
              />
            </div>
            <span className={`text-sm font-medium ${confidenceColor}`}>
              {(merchant.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {merchant.avgTransactionAmount && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Avg Amount</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              ${merchant.avgTransactionAmount.toFixed(2)}
            </span>
          </div>
        )}

        {merchant.tags && merchant.tags.length > 0 && (
          <div className="flex items-center gap-2 pt-2">
            <TagIcon size={14} className="text-gray-400" />
            <div className="flex flex-wrap gap-1">
              {merchant.tags.map(tag => (
                <span 
                  key={tag}
                  className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 text-xs text-gray-400">
          Updated {lastUpdated}
        </div>
      </div>
    </div>
  );
});