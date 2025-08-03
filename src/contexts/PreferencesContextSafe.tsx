/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface PreferencesContextType {
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
  // Theme scheduling
  themeSchedule: {
    enabled: boolean;
    lightStartTime: string; // HH:MM format
    darkStartTime: string; // HH:MM format
  };
  setThemeSchedule: (schedule: { enabled: boolean; lightStartTime: string; darkStartTime: string }) => void;
  // Page visibility settings
  showBudget: boolean;
  setShowBudget: (value: boolean) => void;
  showGoals: boolean;
  setShowGoals: (value: boolean) => void;
  showAnalytics: boolean;
  setShowAnalytics: (value: boolean) => void;
  // Goal celebrations
  enableGoalCelebrations: boolean;
  setEnableGoalCelebrations: (value: boolean) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  console.log('PreferencesProvider initializing...');
  
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

  const actualTheme = 'light'; // Simplified for testing

  console.log('PreferencesProvider state initialized');

  const value = {
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

  console.log('PreferencesProvider rendering with value:', value);

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