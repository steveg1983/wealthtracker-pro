import React, { useCallback, useMemo, useState } from 'react';
import { VirtualizedList } from './VirtualizedListSystem';
import { 
  SearchIcon, 
  FileTextIcon, 
  WalletIcon, 
  FolderIcon, 
  CalendarIcon,
  TrendingUpIcon,
  FilterIcon,
  ClockIcon
} from './icons';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';

interface SearchResult {
  id: string;
  type: 'transaction' | 'account' | 'category' | 'budget' | 'goal' | 'report';
  title: string;
  subtitle?: string;
  description?: string;
  date?: Date;
  amount?: number;
  matchedFields?: string[];
  relevanceScore?: number;
  data: unknown;
}

interface ResultHeader {
  isHeader: true;
  type: SearchResult['type'];
  count: number;
}

type ResultItem = SearchResult | ResultHeader;

interface VirtualizedSearchResultsProps {
  results: SearchResult[];
  query: string;
  onResultClick: (result: SearchResult) => void;
  loading?: boolean;
  onLoadMore?: () => Promise<void>;
  hasMore?: boolean;
  groupByType?: boolean;
  showRelevanceScore?: boolean;
  className?: string;
}

/**
 * High-performance search results display
 * Handles thousands of results with smooth scrolling
 */
export function VirtualizedSearchResults({
  results,
  query,
  onResultClick,
  loading = false,
  onLoadMore,
  hasMore = false,
  groupByType = true,
  showRelevanceScore = false,
  className = ''
}: VirtualizedSearchResultsProps): React.JSX.Element {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { formatCurrency } = useCurrencyDecimal();

  const isHeaderItem = useCallback((item: ResultItem): item is ResultHeader => {
    return (item as ResultHeader).isHeader === true;
  }, []);

  // Group results by type if requested
  const processedResults = useMemo(() => {
    if (!groupByType) return results;

    const grouped = results.reduce<Record<SearchResult['type'], SearchResult[]>>((acc, result) => {
      if (!acc[result.type]) acc[result.type] = [];
      acc[result.type].push(result);
      return acc;
    }, {} as Record<SearchResult['type'], SearchResult[]>);

    // Flatten with headers
    const flattened: ResultItem[] = [];
    
    Object.entries(grouped).forEach(([type, items]) => {
      const header: ResultHeader = { isHeader: true, type: type as SearchResult['type'], count: items.length };
      flattened.push(header, ...items);
    });

    return flattened;
  }, [results, groupByType]);

  // Get icon for result type
  const getResultIcon = useCallback((type: string) => {
    switch (type) {
      case 'transaction':
        return <FileTextIcon size={18} className="text-blue-500" />;
      case 'account':
        return <WalletIcon size={18} className="text-green-500" />;
      case 'category':
        return <FolderIcon size={18} className="text-purple-500" />;
      case 'budget':
        return <TrendingUpIcon size={18} className="text-orange-500" />;
      case 'goal':
        return <TrendingUpIcon size={18} className="text-indigo-500" />;
      case 'report':
        return <FilterIcon size={18} className="text-gray-500" />;
      default:
        return <FileTextIcon size={18} className="text-gray-400" />;
    }
  }, []);

  // Get type label
  const getTypeLabel = useCallback((type: string, count?: number) => {
    const labels: Record<string, string> = {
      transaction: 'Transactions',
      account: 'Accounts',
      category: 'Categories',
      budget: 'Budgets',
      goal: 'Goals',
      report: 'Reports'
    };
    const label = labels[type] || type;
    return count ? `${label} (${count})` : label;
  }, []);

  // Highlight matching text
  const highlightMatch = useCallback((text: string, query: string) => {
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
  }, []);

  // Format amount
  const formatAmount = useCallback((amount: number) => {
    return formatCurrency(toDecimal(amount));
  }, [formatCurrency]);

  // Format date
  const formatDate = useCallback((date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  // Toggle expanded state
  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Render individual result
  const renderResult = useCallback((item: ResultItem, index: number, isScrolling?: boolean) => {
    // Check if it's a header
    if (isHeaderItem(item)) {
      return (
        <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            {getResultIcon(item.type)}
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              {getTypeLabel(item.type, item.count)}
            </span>
          </div>
        </div>
      );
    }

    const result = item;
    const isExpanded = expandedIds.has(result.id);

    // Simplified view when scrolling
    if (isScrolling) {
      return (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2 animate-pulse" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
        </div>
      );
    }

    return (
      <div
        className="p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors group"
        onClick={() => onResultClick(result)}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {getResultIcon(result.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">
                  {highlightMatch(result.title, query)}
                </div>
                
                {result.subtitle && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                    {highlightMatch(result.subtitle, query)}
                  </div>
                )}
                
                {result.description && (
                  <div className={`text-sm text-gray-500 dark:text-gray-500 mt-1 ${
                    isExpanded ? '' : 'line-clamp-2'
                  }`}>
                    {highlightMatch(result.description, query)}
                  </div>
                )}
                
                {/* Matched fields */}
                {result.matchedFields && result.matchedFields.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {result.matchedFields.map((field, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded"
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
                    {formatAmount(result.amount)}
                  </div>
                )}
                
                {result.date && (
                  <div className="text-xs text-gray-500 mt-1 flex items-center justify-end gap-1">
                    <CalendarIcon size={12} />
                    {formatDate(result.date)}
                  </div>
                )}
                
                {showRelevanceScore && result.relevanceScore !== undefined && (
                  <div className="text-xs text-gray-400 mt-1">
                    {Math.round(result.relevanceScore * 100)}% match
                  </div>
                )}
              </div>
            </div>
            
            {/* Expand/collapse for long descriptions */}
            {result.description && result.description.length > 150 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(result.id);
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
  }, [
    expandedIds,
    getResultIcon,
    getTypeLabel,
    highlightMatch,
    formatAmount,
    formatDate,
    onResultClick,
    query,
    showRelevanceScore,
    toggleExpanded,
    isHeaderItem
  ]);

  // Calculate item heights
  const getItemHeight = useCallback((index: number) => {
    const item = processedResults[index];
    if (isHeaderItem(item)) return 44;
    
    const result = item as SearchResult;
    const isExpanded = expandedIds.has(result.id);
    let height = 80; // Base height
    
    if (result.subtitle) height += 20;
    if (result.description) {
      height += isExpanded ? Math.min(result.description.length / 2, 100) : 40;
    }
    if (result.matchedFields?.length) height += 30;
    
    return height;
  }, [processedResults, expandedIds, isHeaderItem]);

  return (
    <div className={className}>
      {/* Search summary */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SearchIcon size={18} className="text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {results.length} results for "{query}"
            </span>
          </div>
          
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <ClockIcon size={14} className="animate-spin" />
              Searching...
            </div>
          )}
        </div>
      </div>

      {/* Results list */}
      <VirtualizedList
        items={processedResults}
        renderItem={renderResult}
        itemHeight={getItemHeight}
        overscan={5}
        onLoadMore={onLoadMore}
        hasMore={hasMore}
        loading={loading}
        className="h-[600px]"
        emptyState={
          <div className="p-8 text-center">
            <SearchIcon size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-2">No results found</p>
            <p className="text-sm text-gray-400">
              Try adjusting your search terms or filters
            </p>
          </div>
        }
      />
    </div>
  );
}

/**
 * Quick search preview with virtualization
 * Shows top results in a compact format
 */
export function VirtualizedQuickSearch({
  results,
  query: _query,
  onResultClick,
  onSeeAll,
  maxHeight = 400
}: {
  results: SearchResult[];
  query: string;
  onResultClick: (result: SearchResult) => void;
  onSeeAll?: () => void;
  maxHeight?: number;
}): React.JSX.Element {
  const topResults = results.slice(0, 10);
  const { formatCurrency } = useCurrencyDecimal();

  const formatAmount = useCallback((amount: number) => formatCurrency(toDecimal(amount)), [formatCurrency]);

  const renderQuickResult = useCallback((result: SearchResult, _index: number) => (
    <div
      className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
      onClick={() => onResultClick(result)}
    >
      <div className="flex items-center gap-3">
        {getResultIcon(result.type)}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {result.title}
          </div>
          {result.subtitle && (
            <div className="text-xs text-gray-500 truncate">
              {result.subtitle}
            </div>
          )}
        </div>
        {result.amount !== undefined && (
          <div className={`text-sm font-medium ${
            result.amount < 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {formatAmount(result.amount)}
          </div>
        )}
      </div>
    </div>
  ), [onResultClick, formatAmount]);

  const getResultIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      transaction: <FileTextIcon size={16} />,
      account: <WalletIcon size={16} />,
      category: <FolderIcon size={16} />
    };
    return icons[type] || <FileTextIcon size={16} />;
  };

  return (
    <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div style={{ maxHeight }}>
        {topResults.map((result, idx) => (
          <div key={result.id}>
            {renderQuickResult(result, idx)}
          </div>
        ))}
      </div>
      
      {results.length > 10 && onSeeAll && (
        <button
          onClick={onSeeAll}
          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm text-primary font-medium transition-colors"
        >
          See all {results.length} results
        </button>
      )}
    </div>
  );
}
