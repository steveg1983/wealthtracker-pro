import { createContext } from 'react';

export interface NavigationContextType {
  navigate: (path: string) => void;
  setCurrentPage: (page: string) => void;
  setSelectedAccountId: (accountId: string | null) => void;
}

export const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

