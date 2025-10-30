import { createContext } from 'react';
import type { AppContextType } from './AppContextSupabase.types';

export const AppContext = createContext<AppContextType | undefined>(undefined);
