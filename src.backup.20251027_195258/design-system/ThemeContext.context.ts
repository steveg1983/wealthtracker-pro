import { createContext } from 'react';
import type { ThemeContextValue } from './ThemeProvider.types';

export const ThemeContext = createContext<ThemeContextValue | null>(null);
