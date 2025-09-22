/**
 * @module MerchantEnrichmentTypes
 * @description Enterprise-grade type definitions for merchant enrichment components
 */

import type { MerchantData } from '../../services/dataIntelligenceService';

/**
 * Merchant statistics
 */
export interface MerchantStats {
  totalMerchants: number;
  enrichedCount: number;
  pendingCount: number;
  averageConfidence: number;
  categoriesUsed: number;
}

/**
 * Filter options for merchant list
 */
export interface FilterOptions {
  searchTerm: string;
  selectedCategory: string;
  sortBy: SortOption;
  showOnlyPending?: boolean;
  minConfidence?: number;
}

/**
 * Sort options
 */
export type SortOption = 'name' | 'confidence' | 'frequency' | 'lastUpdated';

/**
 * Main component props
 */
export interface MerchantEnrichmentProps {
  onDataChange?: () => void;
  enableBulkOperations?: boolean;
  showStats?: boolean;
  className?: string;
}

/**
 * Header props
 */
export interface HeaderProps {
  onRefresh: () => void;
  isRefreshing?: boolean;
  totalCount?: number;
}

/**
 * Stats section props
 */
export interface StatsSectionProps {
  stats: MerchantStats;
  onToggle?: () => void;
  isExpanded?: boolean;
}

/**
 * Filter section props
 */
export interface FilterSectionProps {
  searchTerm: string;
  selectedCategory: string;
  sortBy: SortOption;
  categories: string[];
  onSearchChange: (term: string) => void;
  onCategoryChange: (category: string) => void;
  onSortChange: (sort: SortOption) => void;
}

/**
 * Merchant list props
 */
export interface MerchantListProps {
  merchants: MerchantData[];
  isLoading: boolean;
  onMerchantUpdate: (merchant: MerchantData) => void;
  onBulkSelect?: (merchantIds: string[]) => void;
  selectedIds?: Set<string>;
}

/**
 * Bulk actions props
 */
export interface BulkActionsProps {
  selectedCount: number;
  onEnrichSelected: () => void;
  onCategorizeSelected: (category: string) => void;
  onClearSelection: () => void;
  isProcessing?: boolean;
}

/**
 * Empty state props
 */
export interface EmptyStateProps {
  searchTerm?: string;
  category?: string;
  onClearFilters?: () => void;
}

/**
 * Loading state props
 */
export interface LoadingStateProps {
  message?: string;
  showProgress?: boolean;
  progress?: number;
}

/**
 * Enrichment result
 */
export interface EnrichmentResult {
  merchantId: string;
  success: boolean;
  category?: string;
  confidence?: number;
  error?: string;
}