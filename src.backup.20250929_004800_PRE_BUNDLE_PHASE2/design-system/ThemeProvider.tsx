import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { themes, getTheme, getThemeByMode } from './themes';
import type { Theme } from './themes';
import { applyTheme } from './utils';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (themeId: string) => void;
  setThemeByMode: (colorTheme: string, isDark: boolean) => void;
  availableThemes: typeof themes;
  createCustomTheme: (name: string, baseThemeId: string, overrides: any) => void;
  customThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: string;
  storageKey?: string;
}

export function ThemeProvider({ 
  children, 
  defaultTheme = 'lightBlue',
  storageKey = 'wealthtracker-theme'
}: ThemeProviderProps): React.JSX.Element {
  const [currentThemeId, setCurrentThemeId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(storageKey) || defaultTheme;
    }
    return defaultTheme;
  });
  
  const [customThemes, setCustomThemes] = useState<Theme[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`${storageKey}-custom`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  const theme = getTheme(currentThemeId) || customThemes.find(t => t.id === currentThemeId) || getTheme(defaultTheme);

  const setTheme = useCallback((themeId: string) => {
    setCurrentThemeId(themeId);
    localStorage.setItem(storageKey, themeId);
    
    const newTheme = getTheme(themeId) || customThemes.find(t => t.id === themeId);
    if (newTheme) {
      applyTheme(newTheme);
    }
  }, [storageKey, customThemes]);

  const setThemeByMode = useCallback((colorTheme: string, isDark: boolean) => {
    const theme = getThemeByMode(colorTheme, isDark);
    setTheme(theme.id);
  }, [setTheme]);

  const createCustomTheme = useCallback((name: string, baseThemeId: string, overrides: any) => {
    const baseTheme = getTheme(baseThemeId);
    const customTheme: Theme = {
      id: `custom-${Date.now()}`,
      name,
      description: `Custom theme based on ${baseTheme.name}`,
      isDark: baseTheme.isDark,
      colors: {
        ...baseTheme.colors,
        ...overrides
      }
    };
    
    const newCustomThemes = [...customThemes, customTheme];
    setCustomThemes(newCustomThemes);
    localStorage.setItem(`${storageKey}-custom`, JSON.stringify(newCustomThemes));
    
    // Apply the new theme
    setTheme(customTheme.id);
  }, [customThemes, storageKey, setTheme]);

  // Apply theme on mount and changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Sync with system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      // Only react to system changes if using auto mode
      const savedMode = localStorage.getItem('theme-mode');
      if (savedMode === 'auto') {
        const colorTheme = localStorage.getItem('color-theme') || 'blue';
        setThemeByMode(colorTheme, e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [setThemeByMode]);

  const value: ThemeContextValue = {
    theme,
    setTheme,
    setThemeByMode,
    availableThemes: themes,
    createCustomTheme,
    customThemes
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}