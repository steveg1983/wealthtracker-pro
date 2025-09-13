import { memo, useCallback, useEffect } from 'react';
import { 
  FileTextIcon, 
  WalletIcon, 
  FolderIcon, 
  TrendingUpIcon,
  FilterIcon,
  CalendarIcon
} from '../icons';
import { VirtualizedSearchService } from '../../services/virtualizedSearchService';
import { logger } from '../../services/loggingService';

interface SearchResultItemProps {
  result: any;
  query: string;
  isExpanded: boolean;
  showRelevanceScore: boolean;
  onToggleExpand: () => void;
  onClick: () => void;
}

export const SearchResultItem = memo(function SearchResultItem({
  result,
  query,
  isExpanded,
  showRelevanceScore,
  onToggleExpand,
  onClick
}: SearchResultItemProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('SearchResultItem component initialized', {
      componentName: 'SearchResultItem'
    });
  }, []);

  const getResultIcon = useCallback((type: string) => {
    const iconColor = VirtualizedSearchService.getIconColor(type);
    switch (type) {
      case 'transaction':
        return <FileTextIcon size={18} className={iconColor} />;
      case 'account':
        return <WalletIcon size={18} className={iconColor} />;
      case 'category':
        return <FolderIcon size={18} className={iconColor} />;
      case 'budget':
      case 'goal':
        return <TrendingUpIcon size={18} className={iconColor} />;
      case 'report':
        return <FilterIcon size={18} className={iconColor} />;
      default:
        return <FileTextIcon size={18} className="text-gray-400" />;
    }
  }, []);

  const highlightMatch = useCallback((text: string) => {
    if (!query) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded px-0.5">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  }, [query]);

  return (
    <div
      className="p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors group"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getResultIcon(result.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-white">
                {highlightMatch(result.title)}
              </div>
              
              {result.subtitle && (
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  {highlightMatch(result.subtitle)}
                </div>
              )}
              
              {result.description && (
                <div className={`text-sm text-gray-500 dark:text-gray-500 mt-1 ${
                  isExpanded ? '' : 'line-clamp-2'
                }`}>
                  {highlightMatch(result.description)}
                </div>
              )}
              
              {result.matchedFields && result.matchedFields.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {result.matchedFields.map((field: string, idx: number) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-1 bg-blue-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-500 rounded"
                    >
                      Matched: {field}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex-shrink-0 text-right">
              {result.amount !== undefined && (
                <div className={`font-semibold ${
                  result.amount < 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {VirtualizedSearchService.formatAmount(result.amount)}
                </div>
              )}
              
              {result.date && (
                <div className="text-xs text-gray-500 mt-1 flex items-center justify-end gap-1">
                  <CalendarIcon size={12} />
                  {VirtualizedSearchService.formatDate(result.date)}
                </div>
              )}
              
              {showRelevanceScore && result.relevanceScore !== undefined && (
                <div className="text-xs text-gray-400 mt-1">
                  {Math.round(result.relevanceScore * 100)}% match
                </div>
              )}
            </div>
          </div>
          
          {result.description && result.description.length > 150 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              className="text-xs text-primary hover:underline mt-1"
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});