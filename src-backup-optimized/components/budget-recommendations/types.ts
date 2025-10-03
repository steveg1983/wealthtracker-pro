/**
 * @module BudgetRecommendationsTypes
 * @description Type definitions for budget recommendations components
 */

import type { BudgetRecommendation } from '../../services/budgetRecommendationService';

export interface HeaderProps {
  onExport: () => void;
  onToggleSettings: () => void;
  showSettings?: boolean;
}

export interface ApplySelectedBarProps {
  count: number;
  onApply: () => void;
}

export interface RecommendationsListProps {
  highPriority: BudgetRecommendation[];
  other: BudgetRecommendation[];
  selectedRecommendations: Set<string>;
  onToggleSelect: (id: string) => void;
  onApply: (recommendation: BudgetRecommendation) => void;
  formatCurrency: (value: number) => string;
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: BudgetSettings;
  onSave: (settings: BudgetSettings) => void;
}

export interface BudgetSettings {
  overspendingThreshold: number;
  savingsTarget: number;
  autoApply: boolean;
}