import { useContext } from 'react';
import { ThemeContext } from './ThemeContext.context';
import type { ThemeContextValue } from './ThemeProvider.types';

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
