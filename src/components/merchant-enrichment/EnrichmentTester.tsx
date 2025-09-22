import { memo, useState, useEffect } from 'react';
import { SearchIcon, CheckCircleIcon, XCircleIcon } from '../icons';
import { dataIntelligenceService } from '../../services/dataIntelligenceService';
import { MerchantEnrichmentService } from '../../services/merchantEnrichmentService';
import type { MerchantEnrichment } from '../../services/dataIntelligenceService';
import { useLogger } from '../services/ServiceProvider';

export const EnrichmentTester = memo(function EnrichmentTester(): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('EnrichmentTester component initialized', {
      componentName: 'EnrichmentTester'
    });
  }, []);

  const [testInput, setTestInput] = useState('');
  const [result, setResult] = useState<MerchantEnrichment | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTest = () => {
    if (!testInput.trim()) return;
    
    setIsLoading(true);
    setTimeout(() => {
      const enrichment = dataIntelligenceService.enrichMerchant(testInput);
      setResult(enrichment);
      setIsLoading(false);
    }, 500);
  };

  const qualityBadge = result ? 
    MerchantEnrichmentService.getEnrichmentQualityBadge(result) : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Test Merchant Enrichment
      </h3>
      
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleTest()}
          placeholder="Enter merchant name (e.g., AMZN*MKTP)"
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
        />
        <button
          onClick={handleTest}
          disabled={isLoading || !testInput.trim()}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading ? (
            <>Loading...</>
          ) : (
            <>
              <SearchIcon size={16} />
              Test
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900 dark:text-white">
              Enrichment Result
            </h4>
            {qualityBadge && (
              <span className={`text-xs px-2 py-1 rounded ${qualityBadge.color}`}>
                {qualityBadge.label}
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Clean Name</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {result.cleanName}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Category</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {result.category || 'Unknown'}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Industry</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {result.industry || 'Unknown'}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Confidence</p>
              <div className="flex items-center gap-2">
                {result.confidence >= 0.7 ? (
                  <CheckCircleIcon size={16} className="text-green-500" />
                ) : (
                  <XCircleIcon size={16} className="text-red-500" />
                )}
                <span className={`font-medium ${
                  MerchantEnrichmentService.getConfidenceColor(result.confidence)
                }`}>
                  {(result.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* @ts-ignore - location not in interface */}
            {(result as any).location && (
              <div className="col-span-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">Location</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {(result as any).location.city}, {(result as any).location.state} {(result as any).location.country}
                </p>
              </div>
            )}

            {/* @ts-ignore - tags not in interface */}
            {(result as any).tags && (result as any).tags.length > 0 && (
              <div className="col-span-2">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {(result as any).tags.map((tag: any) => (
                    <span 
                      key={tag}
                      className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});