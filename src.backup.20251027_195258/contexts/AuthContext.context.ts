import { createContext } from 'react';
import type { AuthContextType } from './AuthContext.types';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
