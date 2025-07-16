import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

interface NavigationContextType {
  navigate: (path: string) => void;
  setCurrentPage: (page: string) => void;
  setSelectedAccountId: (accountId: string | null) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ 
  children, 
  navigate, 
  setCurrentPage, 
  setSelectedAccountId 
}: { 
  children: ReactNode;
  navigate: (path: string) => void;
  setCurrentPage: (page: string) => void;
  setSelectedAccountId: (accountId: string | null) => void;
}) {
  return (
    <NavigationContext.Provider value={{ navigate, setCurrentPage, setSelectedAccountId }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}