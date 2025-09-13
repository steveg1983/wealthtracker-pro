/**
 * Spending Patterns Hook
 * Manages state and business logic for spending patterns
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { spendingPatternsService } from '../services/spendingPatternsService';
import type { SpendingPattern } from '../services/dataIntelligenceService';
import type { SortOption } from '../services/spendingPatternsService';

export function useSpendingPatterns(onDataChange?: () => void) {
  const [patterns, setPatterns] = useState<SpendingPattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('confidence');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Load patterns on mount
  useEffect(() => {
    loadPatterns();
  }, []);

  const loadPatterns = useCallback(() => {
    setIsLoading(true);
    const loadedPatterns = spendingPatternsService.loadPatterns();
    setPatterns(loadedPatterns);
    setIsLoading(false);
  }, []);

  const handleAnalyzePatterns = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const analyzedPatterns = await spendingPatternsService.analyzePatterns();
      setPatterns(analyzedPatterns);
      onDataChange?.();
    } finally {
      setIsAnalyzing(false);
    }
  }, [onDataChange]);

  // Calculate stats
  const stats = useMemo(() => 
    spendingPatternsService.calculateStats(patterns),
    [patterns]
  );

  // Calculate distribution
  const distribution = useMemo(() => 
    spendingPatternsService.calculateDistribution(patterns),
    [patterns]
  );

  // Get categories
  const categories = useMemo(() => 
    spendingPatternsService.getCategories(patterns),
    [patterns]
  );

  // Pattern types
  const patternTypes = ['all', 'recurring', 'seasonal', 'trend', 'anomaly'];

  // Filter and sort patterns
  const filteredPatterns = useMemo(() => {
    const filtered = spendingPatternsService.filterPatterns(
      patterns,
      selectedType,
      selectedCategory
    );
    return spendingPatternsService.sortPatterns(filtered, sortBy);
  }, [patterns, selectedType, selectedCategory, sortBy]);

  return {
    patterns: filteredPatterns,
    stats,
    distribution,
    categories,
    patternTypes,
    isLoading,
    isAnalyzing,
    selectedType,
    selectedCategory,
    sortBy,
    setSelectedType,
    setSelectedCategory,
    setSortBy,
    handleAnalyzePatterns
  };
}