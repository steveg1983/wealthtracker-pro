import { memo, useEffect } from 'react';
import { PlusIcon, TrashIcon } from '../../icons';
import type { Asset } from '../../../services/portfolioOptimizationService';
import { logger } from '../../../services/loggingService';

interface AssetManagerProps {
  assets: Asset[];
  onUpdateAsset: (index: number, field: keyof Asset, value: string | number) => void;
  onAddAsset: () => void;
  onRemoveAsset: (index: number) => void;
}

/**
 * Asset manager component
 * Handles the addition, removal, and editing of portfolio assets
 */
export const AssetManager = memo(function AssetManager({
  assets,
  onUpdateAsset,
  onAddAsset,
  onRemoveAsset
}: AssetManagerProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('AssetManager component initialized', {
      componentName: 'AssetManager'
    });
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Asset Classes
        </label>
        <button
          onClick={onAddAsset}
          className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          <PlusIcon size={14} />
          Add Asset
        </button>
      </div>
      
      <div className="space-y-2">
        {assets.map((asset, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={asset.symbol}
              onChange={(e) => onUpdateAsset(index, 'symbol', e.target.value)}
              className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Symbol"
            />
            <input
              type="text"
              value={asset.name}
              onChange={(e) => onUpdateAsset(index, 'name', e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Name"
            />
            <input
              type="number"
              value={(asset.expectedReturn * 100).toFixed(1)}
              onChange={(e) => onUpdateAsset(index, 'expectedReturn', Number(e.target.value) / 100)}
              className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              step="0.1"
              placeholder="Return %"
            />
            <input
              type="number"
              value={(asset.volatility * 100).toFixed(1)}
              onChange={(e) => onUpdateAsset(index, 'volatility', Number(e.target.value) / 100)}
              className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              step="0.1"
              placeholder="Risk %"
            />
            {assets.length > 2 && (
              <button
                onClick={() => onRemoveAsset(index)}
                className="p-1 text-red-600 hover:text-red-700"
              >
                <TrashIcon size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});