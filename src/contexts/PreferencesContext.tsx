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
  accentColor: string;
  setAccentColor: (value: string) => void;
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
    if (!saved || !['light', 'dark', 'auto'].includes(saved)) {
      return 'light';
    }
    return saved as 'light' | 'dark' | 'auto';
  });

  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem('money_management_accent_color') || 'blue';
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
        newTheme = 'light';
      }
      
      setActualTheme(newTheme);
    };

    updateActualTheme();

    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => updateActualTheme();
      mediaQuery.addEventListener('change', handleChange);

      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  // Apply theme classes
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove theme classes
    root.classList.remove('dark');
    root.classList.remove('light');
    
    // Add theme class
    if (actualTheme === 'dark') {
      root.classList.add('dark');
    }
  }, [actualTheme]);

  // Apply accent color class
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
    
    // Log for debugging
    console.log('Accent color applied:', accentColor, root.className);
  }, [accentColor]);

  useEffect(() => {
    localStorage.setItem('money_management_compact_view', compactView.toString());
  }, [compactView]);

  useEffect(() => {
    localStorage.setItem('money_management_currency', currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem('money_management_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('money_management_accent_color', accentColor);
  }, [accentColor]);

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
