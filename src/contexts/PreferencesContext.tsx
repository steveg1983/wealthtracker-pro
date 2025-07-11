import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface PreferencesContextType {
  compactView: boolean;
  setCompactView: (value: boolean) => void;
  currency: string;
  setCurrency: (value: string) => void;
  theme: 'light' | 'dark' | 'auto';
  setTheme: (value: 'light' | 'dark' | 'auto') => void;
  actualTheme: 'light' | 'dark';
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
    // If no saved theme or invalid, default to 'light'
    if (!saved || !['light', 'dark', 'auto'].includes(saved)) {
      return 'light';
    }
    return saved as 'light' | 'dark' | 'auto';
  });

  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light');

  // Handle theme changes and auto theme
  useEffect(() => {
    const updateActualTheme = () => {
      let newTheme: 'light' | 'dark' = 'light';
      
      if (theme === 'dark') {
        newTheme = 'dark';
      } else if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        newTheme = prefersDark ? 'dark' : 'light';
      } else {
        // Default to light for any other case
        newTheme = 'light';
      }
      
      setActualTheme(newTheme);
    };

    updateActualTheme();

    // Listen for system theme changes only when in auto mode
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => updateActualTheme();
      mediaQuery.addEventListener('change', handleChange);

      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  // Apply or remove dark class from document
  useEffect(() => {
    const root = document.documentElement;
    
    // Force remove all theme classes first
    root.classList.remove('dark');
    root.classList.remove('light');
    
    // Force remove any style attribute that might be setting dark mode
    root.removeAttribute('style');
    
    // Wait a tick then add the correct class
    setTimeout(() => {
      if (actualTheme === 'dark') {
        root.classList.add('dark');
      }
      // We don't need to add 'light' class as light is the default
      
      // Log for debugging
      console.log('Theme Debug:', {
        selectedTheme: theme,
        actualTheme: actualTheme,
        htmlClasses: root.className,
        localStorage: localStorage.getItem('money_management_theme')
      });
    }, 10);
  }, [actualTheme]);

  useEffect(() => {
    localStorage.setItem('money_management_compact_view', compactView.toString());
  }, [compactView]);

  useEffect(() => {
    localStorage.setItem('money_management_currency', currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem('money_management_theme', theme);
  }, [theme]);

  return (
    <PreferencesContext.Provider value={{
      compactView,
      setCompactView,
      currency,
      setCurrency,
      theme,
      setTheme,
      actualTheme,
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
