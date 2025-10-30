import type { ReactNode } from 'react';
import { themes } from './themes';
import type { Theme } from './themes';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (themeId: string) => void;
  setThemeByMode: (colorTheme: string, isDark: boolean) => void;
  availableThemes: typeof themes;
  createCustomTheme: (name: string, baseThemeId: string, overrides: Partial<Theme['colors']>) => void;
  customThemes: Theme[];
}

export interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: string;
  storageKey?: string;
}
