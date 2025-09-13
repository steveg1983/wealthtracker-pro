/**
 * @module BudgetRecommendationsUtils
 * @description Utility functions for budget recommendations
 */

import { budgetRecommendationService, type BudgetAnalysis } from '../../services/budgetRecommendationService';

/**
 * Export budget recommendations to a downloadable file
 */
export function exportRecommendations(analysis: BudgetAnalysis | null): void {
  if (!analysis) return;
  
  const content = budgetRecommendationService.exportRecommendations(analysis);
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `budget-recommendations-${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}