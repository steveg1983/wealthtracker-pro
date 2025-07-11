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
    
    root.classList.remove('dark');
    root.classList.remove('light');
    root.removeAttribute('style');
    
    setTimeout(() => {
      if (actualTheme === 'dark') {
        root.classList.add('dark');
      }
    }, 10);
  }, [actualTheme]);

  // Apply accent color as CSS variable
  useEffect(() => {
    const root = document.documentElement;
    const colors: Record<string, { primary: string; secondary: string }> = {
      blue: { primary: '#0078d4', secondary: '#005a9e' },
      green: { primary: '#34c759', secondary: '#248a3d' },
      purple: { primary: '#af52de', secondary: '#8e3cbf' },
      orange: { primary: '#ff9500', secondary: '#e67e00' },
      red: { primary: '#ff3b30', secondary: '#d70015' },
      pink: { primary: '#ff2d55', secondary: '#d30036' },
      indigo: { primary: '#5856d6', secondary: '#3634a3' },
      teal: { primary: '#5ac8fa', secondary: '#32ade6' },
      yellow: { primary: '#ffcc00', secondary: '#d6ab00' },
      gray: { primary: '#8e8e93', secondary: '#636366' },
    };

    const selectedColor = colors[accentColor] || colors.blue;
    root.style.setProperty('--color-primary', selectedColor.primary);
    root.style.setProperty('--color-secondary', selectedColor.secondary);
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
