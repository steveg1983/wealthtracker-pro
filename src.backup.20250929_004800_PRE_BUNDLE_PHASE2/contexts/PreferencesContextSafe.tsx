/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { logger } from '../services/loggingService';

interface PreferencesContextType {
  compactView: boolean;
  setCompactView: Dispatch<SetStateAction<boolean>>;
  currency: string;
  setCurrency: Dispatch<SetStateAction<string>>;
  theme: 'light' | 'dark' | 'auto' | 'scheduled';
  setTheme: Dispatch<SetStateAction<'light' | 'dark' | 'auto' | 'scheduled'>>;
  actualTheme: 'light' | 'dark';
  colorTheme: 'blue' | 'green' | 'red' | 'pink';
  setColorTheme: Dispatch<SetStateAction<'blue' | 'green' | 'red' | 'pink'>>;
  firstName: string;
  setFirstName: Dispatch<SetStateAction<string>>;
  // Theme scheduling
  themeSchedule: {
    enabled: boolean;
    lightStartTime: string; // HH:MM format
    darkStartTime: string; // HH:MM format
  };
  setThemeSchedule: Dispatch<SetStateAction<{ enabled: boolean; lightStartTime: string; darkStartTime: string }>>;
  // Page visibility settings
  showBudget: boolean;
  setShowBudget: Dispatch<SetStateAction<boolean>>;
  showGoals: boolean;
  setShowGoals: Dispatch<SetStateAction<boolean>>;
  showAnalytics: boolean;
  setShowAnalytics: Dispatch<SetStateAction<boolean>>;
  // Goal celebrations
  enableGoalCelebrations: boolean;
  setEnableGoalCelebrations: Dispatch<SetStateAction<boolean>>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  logger.debug('PreferencesProvider initializing...');
  
  // Use simple defaults without localStorage for testing
  const [compactView, setCompactView] = useState(true); // Default to compact view
  const [currency, setCurrency] = useState('GBP');
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto' | 'scheduled'>('light');
  const [colorTheme, setColorTheme] = useState<'blue' | 'green' | 'red' | 'pink'>('blue');
  const [firstName, setFirstName] = useState('');
  const [showBudget, setShowBudget] = useState(true);
  const [showGoals, setShowGoals] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [enableGoalCelebrations, setEnableGoalCelebrations] = useState(true);
  const [themeSchedule, setThemeSchedule] = useState({
    enabled: false,
    lightStartTime: '06:00',
    darkStartTime: '18:00'
  });

  const actualTheme: 'light' | 'dark' = 'light'; // Simplified for testing

  logger.debug('PreferencesProvider state initialized');

  const value: PreferencesContextType = {
    compactView,
    setCompactView,
    currency,
    setCurrency,
    theme,
    setTheme,
    actualTheme,
    colorTheme,
    setColorTheme,
    firstName,
    setFirstName,
    themeSchedule,
    setThemeSchedule,
    showBudget,
    setShowBudget,
    showGoals,
    setShowGoals,
    showAnalytics,
    setShowAnalytics,
    enableGoalCelebrations,
    setEnableGoalCelebrations,
  };

  logger.debug('PreferencesProvider rendering', value);

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return context;
}
