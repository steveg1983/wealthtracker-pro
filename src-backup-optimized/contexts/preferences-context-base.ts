import { createContext } from 'react';

export interface PreferencesContextType {
  compactView: boolean;
  setCompactView: (value: boolean) => void;
  currency: string;
  setCurrency: (value: string) => void;
  theme: 'light' | 'dark' | 'auto' | 'scheduled';
  setTheme: (value: 'light' | 'dark' | 'auto' | 'scheduled') => void;
  actualTheme: 'light' | 'dark';
  colorTheme: 'blue' | 'green' | 'red' | 'pink';
  setColorTheme: (value: 'blue' | 'green' | 'red' | 'pink') => void;
  firstName: string;
  setFirstName: (value: string) => void;
  themeSchedule: {
    enabled: boolean;
    lightStartTime: string;
    darkStartTime: string;
  };
  setThemeSchedule: (schedule: { enabled: boolean; lightStartTime: string; darkStartTime: string }) => void;
  showBudget: boolean;
  setShowBudget: (value: boolean) => void;
  showGoals: boolean;
  setShowGoals: (value: boolean) => void;
  showAnalytics: boolean;
  setShowAnalytics: (value: boolean) => void;
  showInvestments: boolean;
  setShowInvestments: (value: boolean) => void;
  showEnhancedInvestments: boolean;
  setShowEnhancedInvestments: (value: boolean) => void;
  showAIAnalytics: boolean;
  setShowAIAnalytics: (value: boolean) => void;
  showFinancialPlanning: boolean;
  setShowFinancialPlanning: (value: boolean) => void;
  showDataIntelligence: boolean;
  setShowDataIntelligence: (value: boolean) => void;
  showSummaries: boolean;
  setShowSummaries: (value: boolean) => void;
  showTaxPlanning: boolean;
  setShowTaxPlanning: (value: boolean) => void;
  showHousehold: boolean;
  setShowHousehold: (value: boolean) => void;
  showBusinessFeatures: boolean;
  setShowBusinessFeatures: (value: boolean) => void;
  enableGoalCelebrations: boolean;
  setEnableGoalCelebrations: (value: boolean) => void;
  preferences: Record<string, unknown>;
  updatePreferences: (updates: Record<string, unknown>) => void;
}

export const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

