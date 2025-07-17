/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface PreferencesContextType {
  compactView: boolean;
  setCompactView: (value: boolean) => void;
  currency: string;
  setCurrency: (value: string) => void;
  theme: 'light' | 'dark' | 'auto';
  setTheme: (value: 'light' | 'dark' | 'auto') => void;
  actualTheme: 'light' | 'dark';
  accentColor: string;
  setAccentColor: (value: string) => void;
  firstName: string;
  setFirstName: (value: string) => void;
  // Page visibility settings
  showBudget: boolean;
  setShowBudget: (value: boolean) => void;
  showGoals: boolean;
  setShowGoals: (value: boolean) => void;
  showAnalytics: boolean;
  setShowAnalytics: (value: boolean) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  console.log('PreferencesProvider initializing...');
  
  // Use simple defaults without localStorage for testing
  const [compactView, setCompactView] = useState(false);
  const [currency, setCurrency] = useState('GBP');
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('light');
  const [accentColor, setAccentColor] = useState('#3B82F6');
  const [firstName, setFirstName] = useState('');
  const [showBudget, setShowBudget] = useState(true);
  const [showGoals, setShowGoals] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(true);

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
    accentColor,
    setAccentColor,
    firstName,
    setFirstName,
    showBudget,
    setShowBudget,
    showGoals,
    setShowGoals,
    showAnalytics,
    setShowAnalytics,
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