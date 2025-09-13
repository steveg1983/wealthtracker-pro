import React, { useEffect, memo } from 'react';
import { DatabaseIcon, RefreshCwIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface DataIntelligenceHeaderProps {
  isAnalyzing: boolean;
  onRunAnalysis: () => void;
}

const DataIntelligenceHeader = memo(function DataIntelligenceHeader({
  isAnalyzing,
  onRunAnalysis
}: DataIntelligenceHeaderProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('DataIntelligenceHeader component initialized', {
      componentName: 'DataIntelligenceHeader'
    });
  }, []);

  return (
    <div className="bg-gradient-to-r from-green-600 to-gray-600 dark:from-green-800 dark:to-gray-800 rounded-2xl p-6 mb-6 text-white shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Data Intelligence</h1>
          <p className="text-green-100">
            Smart insights, subscription management, and spending pattern analysis
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onRunAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCwIcon size={16} className={isAnalyzing ? 'animate-spin' : ''} />
            {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
          </button>
          <DatabaseIcon size={48} className="text-white/80" />
        </div>
      </div>
    </div>
  );
});

export default DataIntelligenceHeader;