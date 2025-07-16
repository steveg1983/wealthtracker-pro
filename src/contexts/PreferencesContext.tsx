/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  const [compactView, setCompactView] = useState(() => {
    const saved = localStorage.getItem('money_management_compact_view');
    return saved === 'true';
  });

  const [currency, setCurrency] = useState(() => {
    return localStorage.getItem('money_management_currency') || 'GBP';
  });

  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>(() => {
    const saved = localStorage.getItem('money_management_theme');
    if (!saved) {
      localStorage.setItem('money_management_theme', 'light');
      return 'light';
    }
    if (!['light', 'dark', 'auto'].includes(saved)) {
      return 'light';
    }
    return saved as 'light' | 'dark' | 'auto';
  });

  const [accentColor, setAccentColor] = useState(() => {
    const saved = localStorage.getItem('money_management_accent_color');
    if (!saved || saved === 'yellow') {  // Force pink if yellow or not set
      localStorage.setItem('money_management_accent_color', 'pink');
      return 'pink';
    }
    return saved;
  });

  const [firstName, setFirstName] = useState(() => {
    return localStorage.getItem('money_management_first_name') || '';
  });

  // Page visibility settings
  const [showBudget, setShowBudget] = useState(() => {
    const saved = localStorage.getItem('money_management_show_budget');
    return saved !== 'false'; // Default to true
  });

  const [showGoals, setShowGoals] = useState(() => {
    const saved = localStorage.getItem('money_management_show_goals');
    return saved !== 'false'; // Default to true
  });

  const [showAnalytics, setShowAnalytics] = useState(() => {
    const saved = localStorage.getItem('money_management_show_analytics');
    return saved !== 'false'; // Default to true
  });

  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('dark');

  // Memoize updateActualTheme to avoid recreating it
  const updateActualTheme = useCallback(() => {
    let newTheme: 'light' | 'dark' = 'light';
    
    if (theme === 'dark') {
      newTheme = 'dark';
    } else if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      newTheme = prefersDark ? 'dark' : 'light';
    } else {
      newTheme = 'light';
    }
    
    setActualTheme(newTheme);
  }, [theme]);

  // Handle theme changes and auto theme
  useEffect(() => {
    updateActualTheme();

    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => updateActualTheme();
      
      // Use the modern addEventListener/removeEventListener pattern
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme, updateActualTheme]);

  // Apply theme classes
  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      
      root.classList.remove('dark');
      
      requestAnimationFrame(() => {
        if (actualTheme === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      });
    };
    
    applyTheme();
    
    const timer = setTimeout(applyTheme, 100);
    
    return () => clearTimeout(timer);
  }, [actualTheme]);

  // Apply accent color class - force pink on mount
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all accent classes
    const accentClasses = [
      'accent-blue', 'accent-green', 'accent-purple', 'accent-orange', 
      'accent-red', 'accent-pink', 'accent-indigo', 'accent-teal', 
      'accent-yellow', 'accent-gray'
    ];
    
    accentClasses.forEach(className => {
      root.classList.remove(className);
    });
    
    // Add the selected accent class
    root.classList.add(`accent-${accentColor}`);
    
    // Force pink if yellow is detected
    if (root.classList.contains('accent-yellow')) {
      root.classList.remove('accent-yellow');
      root.classList.add('accent-pink');
    }
  }, [accentColor]);

  // Consolidate all localStorage updates into a single effect for better performance
  useEffect(() => {
    const savePreferences = () => {
      localStorage.setItem('money_management_compact_view', compactView.toString());
      localStorage.setItem('money_management_currency', currency);
      localStorage.setItem('money_management_theme', theme);
      localStorage.setItem('money_management_accent_color', accentColor);
      localStorage.setItem('money_management_first_name', firstName);
      localStorage.setItem('money_management_show_budget', showBudget.toString());
      localStorage.setItem('money_management_show_goals', showGoals.toString());
      localStorage.setItem('money_management_show_analytics', showAnalytics.toString());
    };

    // Debounce the save to avoid excessive localStorage writes
    const timeoutId = setTimeout(savePreferences, 300);
    
    return () => clearTimeout(timeoutId);
  }, [compactView, currency, theme, accentColor, firstName, showBudget, showGoals, showAnalytics]);

  return (
    <PreferencesContext.Provider value={{
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
    }}>
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
